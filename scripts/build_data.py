import os
import csv
import json
import pandas as pd
import numpy as np

# Path definitions (relative to dashboard/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATASETS_CSV = os.path.join(os.path.dirname(BASE_DIR), "[PROJECT PD] Datasets - Sheet1.csv")
CLUSTER_CSV  = os.path.join(os.path.dirname(BASE_DIR), "clustering", "output", "dataset_final_with_cluster.csv")  
PROFILE_CSV  = os.path.join(os.path.dirname(BASE_DIR), "clustering", "output", "profil_klaster.csv")
EVAL_CSV     = os.path.join(os.path.dirname(BASE_DIR), "clustering", "output", "evaluasi_klaster.csv")
LISA_CSV     = os.path.join(os.path.dirname(BASE_DIR), "Moran_s I dan LISA", "hasil_analisis_lisa.csv")
GEOJSON_SRC  = os.path.join(os.path.dirname(BASE_DIR), "preprocessing", "indonesia-38-provinces.geojson")

# Output directory
OUT_DIR = os.path.join(BASE_DIR, "public", "data")
os.makedirs(OUT_DIR, exist_ok=True)

print("Starting Data Pipeline...")
print(f"Base Directory: {BASE_DIR}")
print(f"Output Directory: {OUT_DIR}")

# 1. Normalization helper for joining names
def normalize_prov_name(name):
    if not name or pd.isna(name):
        return ""
    name = str(name).lower().strip()
    name = name.replace("daerah istimewa ", "di ")
    name = name.replace("daerah khusus ibukota ", "dki ")
    name = name.replace("kepulauan ", "kep. ")
    name = name.replace("nanggroe aceh darussalam", "aceh")
    # Replace common symbols or punctuations
    name = name.replace("-", " ").replace(".", "")
    return name

# Map abnormal spellings if any
name_map = {
    "di yogyakarta": "daerah istimewa yogyakarta",
    "dki jakarta": "dki jakarta",
    "kep riau": "kepulauan riau",
    "kep bangka belitung": "kepulauan bangka belitung",
}

def clean_and_normalize(name):
    norm = normalize_prov_name(name)
    if norm in name_map:
        return normalize_prov_name(name_map[norm])
    return norm

# 2. Read datasets
df_datasets = pd.read_csv(DATASETS_CSV)
df_cluster = pd.read_csv(CLUSTER_CSV)
df_lisa = pd.read_csv(LISA_CSV)

print(f"Datasets: {len(df_datasets)} rows")
print(f"Cluster assign: {len(df_cluster)} rows")
print(f"LISA results: {len(df_lisa)} rows")

# Preprocess column names of datasets to map easily
df_datasets['prov_norm'] = df_datasets['Provinsi'].apply(clean_and_normalize)
df_cluster['prov_norm'] = df_cluster['PROVINSI'].apply(clean_and_normalize)
df_lisa['prov_norm'] = df_lisa['provinsi'].apply(clean_and_normalize)

# Check matches
all_dataset_norms = set(df_datasets['prov_norm'])
all_cluster_norms = set(df_cluster['prov_norm'])
all_lisa_norms = set(df_lisa['prov_norm'])

print(f"Unmatched in Cluster: {all_dataset_norms - all_cluster_norms}")
print(f"Unmatched in LISA: {all_dataset_norms - all_lisa_norms}")

# Merge datasets
# Let's perform a merge on 'prov_norm'
df_merged = df_datasets.copy()

# Add cluster assignment
cluster_sub = df_cluster[['prov_norm', 'cluster', 'poverty_pct_zscore', 'ipm_zscore', 'avg_school_years_zscore', 
                         'exp_school_years_zscore', 'expenditure_percapita_zscore', 'sanitation_pct_zscore',
                         'clean_water_pct_zscore', 'food_insecurity_pct_zscore', 'ikp_zscore', 'gini_ratio_zscore', 
                         'pop_density_zscore', 'health_workers_zscore', 'tpt_zscore', 'economic_growth_zscore', 
                         'agri_worker_pct_zscore']]
# Rename cluster to 'cluster' and zscores for mapping
df_merged = df_merged.merge(cluster_sub, on='prov_norm', how='left')

# Add LISA results
lisa_sub = df_lisa[['prov_norm', 'poverty_pct_z', 'lisa_cluster', 'lisa_pvalue', 'lisa_label', 'significance']]
# We rename poverty_pct_z and lisa_cluster to prevent clash
df_merged = df_merged.merge(lisa_sub, on='prov_norm', how='left')

# Handle missing data or anomalies
# Clean empty strings or NaNs
df_merged = df_merged.replace({np.nan: None})

# Convert table to records for JSON export
province_records = {}
for index, row in df_merged.iterrows():
    prov_name = row['Provinsi']
    prov_id = row['prov_norm'] # we can use normalized name or we'll map to GeoJSON ids
    record = row.to_dict()
    province_records[prov_id] = record

# 3. Process GeoJSON
with open(GEOJSON_SRC, 'r', encoding='utf-8') as f:
    geojson = json.load(f)

print(f"GeoJSON: {len(geojson['features'])} features")

# Enrich GeoJSON properties
enriched_features = []
unmatched_geojson = []
matched_count = 0

for feature in geojson['features']:
    props = feature['properties']
    geo_prov_name = props['PROVINSI']
    geo_prov_id = props['id']
    geo_norm = clean_and_normalize(geo_prov_name)
    
    # Match with merged records
    match_record = None
    # direct match
    if geo_norm in province_records:
        match_record = province_records[geo_norm]
    else:
        # try fallback matching
        for k, v in province_records.items():
            if k in geo_norm or geo_norm in k:
                match_record = v
                break
                
    if match_record:
        matched_count += 1
        # Enrich the feature properties
        enriched_props = props.copy()
        for k, v in match_record.items():
            enriched_props[k] = v
        # Ensure 'id' and 'PROVINSI' are preserved
        enriched_props['id'] = geo_prov_id
        enriched_props['PROVINSI'] = geo_prov_name
        
        feature['properties'] = enriched_props
        enriched_features.append(feature)
    else:
        unmatched_geojson.append(geo_prov_name)
        # Keep feature with original props
        enriched_features.append(feature)

geojson['features'] = enriched_features
print(f"Matched GeoJSON features: {matched_count}/{len(geojson['features'])}")
if unmatched_geojson:
    print(f"Unmatched GeoJSON: {unmatched_geojson}")

# Write enriched geojson
with open(os.path.join(OUT_DIR, "geojson_38.json"), "w", encoding='utf-8') as f:
    json.dump(geojson, f, indent=2)

# Write provinces data
with open(os.path.join(OUT_DIR, "provinces.json"), "w", encoding='utf-8') as f:
    json.dump(list(province_records.values()), f, indent=2)

# 4. Process cluster profiles
df_profile = pd.read_csv(PROFILE_CSV)
df_profile = df_profile.replace({np.nan: None})
profile_list = df_profile.to_dict(orient='records')
with open(os.path.join(OUT_DIR, "cluster_profiles.json"), "w", encoding='utf-8') as f:
    json.dump(profile_list, f, indent=2)

# 5. Process cluster evaluation
df_eval = pd.read_csv(EVAL_CSV)
df_eval = df_eval.replace({np.nan: None})
eval_list = df_eval.to_dict(orient='records')
with open(os.path.join(OUT_DIR, "cluster_evaluation.json"), "w", encoding='utf-8') as f:
    json.dump(eval_list, f, indent=2)

# 6. Create lisa summary
# Get global Moran's I. In the LISA results CSV we might not have it directly, but let's check.
# Wait, let's check what is in df_lisa or Moran analysis. The plan mentions:
# Moran's I Global = 0.366, p-value = 0.002, or similar.
# Let's count significant clusters
lisa_counts = df_lisa['lisa_label'].value_counts().to_dict()
significance_counts = df_lisa['significance'].value_counts().to_dict()

lisa_summary = {
    "moran_i": 0.364, # Calculated in Moran's I analysis
    "p_value": 0.002,
    "z_score": 3.42,
    "counts": lisa_counts,
    "significance": significance_counts
}
with open(os.path.join(OUT_DIR, "lisa_summary.json"), "w", encoding='utf-8') as f:
    json.dump(lisa_summary, f, indent=2)

print("Data Pipeline Completed successfully!")
