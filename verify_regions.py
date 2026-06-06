#!/usr/bin/env python
import sys
sys.path.insert(0, 'c:\\Users\\SALWA\\Documents\\GitHub\\WAREG')

from app.services.dataset import load_dataset_dataframe, build_region_lookup

# Load dataset and get regions
df = load_dataset_dataframe()
region_lookup = build_region_lookup(df)

# Sort by ID to see order
regions_sorted = sorted(region_lookup.items(), key=lambda x: x[1])

print("=== REGIONS FROM DATASET ===")
print(f"Total regions: {len(regions_sorted)}\n")
print("First 20 regions:")
for name, region_id in regions_sorted[:20]:
    print(f"  {region_id:3d}. {name}")

print("\n...\n")
print("Last 10 regions:")
for name, region_id in regions_sorted[-10:]:
    print(f"  {region_id:3d}. {name}")
