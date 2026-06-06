#!/usr/bin/env python
"""Debug script to trace region mapping and market comparison."""

from app import create_app
from app.services.dataset import load_dataset_dataframe, build_region_lookup
from app.services.models import CommodityPrice, db

app = create_app()
with app.app_context():
    print("=== DATASET ANALYSIS ===")
    df = load_dataset_dataframe()
    
    print(f"Total dataset rows: {len(df)}")
    print(f"Admin2 unique count: {df['admin2'].nunique()}")
    print(f"First 10 admin2: {df['admin2'].dropna().unique()[:10]}")
    
    print("\n=== REGION LOOKUP ===")
    regions = build_region_lookup(df)
    print(f"Total regions in lookup: {len(regions)}")
    print(f"First 10 regions: {list(regions.items())[:10]}")
    
    # Check Kota Bandung specifically
    print("\n=== KOTA BANDUNG CHECK ===")
    if 'Kota Bandung' in regions:
        region_id = regions['Kota Bandung']
        print(f"Kota Bandung => region_id: {region_id}")
        
        # Check dataset
        df_bandung_chili = df[
            (df['admin2'].fillna('National').astype(str) == 'Kota Bandung') &
            (df['commodity_name'].str.contains('Chili', case=False, na=False))
        ]
        print(f"Chili rows in Bandung dataset: {len(df_bandung_chili)}")
        print(f"Markets: {df_bandung_chili['market'].unique()[:10]}")
    else:
        print("Kota Bandung NOT in regions!")
    
    print("\n=== DATABASE CHECK ===")
    db_count = CommodityPrice.query.count()
    print(f"Total rows in CommodityPrice DB: {db_count}")
    
    if db_count > 0:
        # Check Bandung in DB
        bandung_rows = CommodityPrice.query.filter_by(region_id=regions.get('Kota Bandung', -1)).count()
        print(f"Rows with Kota Bandung region_id ({regions.get('Kota Bandung')}): {bandung_rows}")
        
        # Check Chili in Bandung from DB
        if regions.get('Kota Bandung'):
            chili_bandung_db = CommodityPrice.query.filter(
                CommodityPrice.region_id == regions['Kota Bandung'],
                CommodityPrice.commodity_name.ilike('%Chili%')
            ).count()
            print(f"Chili rows in Bandung DB: {chili_bandung_db}")
            
            # Show some sample markets
            samples = CommodityPrice.query.filter(
                CommodityPrice.region_id == regions['Kota Bandung'],
                CommodityPrice.commodity_name.ilike('%Chili%')
            ).limit(5).all()
            print(f"Sample markets from DB: {[s.source for s in samples]}")
    else:
        print("DATABASE IS EMPTY - SEEDING FAILED!")
    
    print("\n=== ENDPOINT TEST ===")
    # Test the endpoint logic manually
    commodity = 'Chili (Red)'
    region_id = regions.get('Kota Bandung', 1)
    
    if region_id:
        rev_lookup = {v: k for k, v in regions.items()}
        region_name = rev_lookup.get(region_id, None)
        print(f"Region name for region_id {region_id}: {region_name}")
        
        if region_name:
            filtered = df[
                (df['admin2'].fillna('National').astype(str) == region_name) &
                (df['commodity_name'].str.contains(commodity, case=False, na=False, regex=False))
            ]
            print(f"Filtered rows: {len(filtered)}")
            if not filtered.empty:
                grouped = filtered.groupby('market', dropna=False)['price_value'].mean().reset_index().sort_values('price_value')
                print(f"Market groups: {len(grouped)}")
                print(f"Top markets:\n{grouped.head(5)}")
