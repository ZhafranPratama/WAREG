from pathlib import Path

import pandas as pd

from app.services.models import CommodityPrice, db

SUPPORTED_COMMODITIES = {
    'Chili (Red)',
    'Eggs',
    'Meat (Beef)',
    'Oil (Vegetable)',
    'Rice',
    'Sugar',
    'Garlic (Medium)',
}


def get_dataset_paths():
    root_dir = Path(__file__).resolve().parents[2]
    csv_path = root_dir / 'wareg_food_prices.csv'
    xlsx_path = root_dir / 'wfp_food_prices_idn_clean_12_category_table.xlsx'
    return csv_path, xlsx_path


def ensure_csv_dataset():
    csv_path, xlsx_path = get_dataset_paths()

    if csv_path.exists():
        return csv_path

    if not xlsx_path.exists():
        raise FileNotFoundError(
            'Dataset CSV dan Excel tidak ditemukan. Pastikan file dataset tersedia di root project.'
        )

    dataframe = pd.read_excel(xlsx_path)
    dataframe.to_csv(csv_path, index=False)
    return csv_path


def load_dataset_dataframe():
    csv_path, _ = get_dataset_paths()
    ensure_csv_dataset()

    dataframe = pd.read_csv(csv_path)

    if 'date' in dataframe.columns and 'recorded_date' not in dataframe.columns:
        dataframe = dataframe.rename(columns={'date': 'recorded_date'})

    if 'price' in dataframe.columns and 'price_value' not in dataframe.columns:
        dataframe = dataframe.rename(columns={'price': 'price_value'})

    if 'commodity' in dataframe.columns and 'commodity_name' not in dataframe.columns:
        dataframe = dataframe.rename(columns={'commodity': 'commodity_name'})

    dataframe['recorded_date'] = pd.to_datetime(dataframe['recorded_date'], errors='coerce').dt.strftime('%Y-%m-%d')
    dataframe['price_value'] = pd.to_numeric(dataframe['price_value'], errors='coerce')
    dataframe['commodity_name'] = dataframe['commodity_name'].fillna('').astype(str)
    dataframe['category'] = dataframe['category'].fillna('Uncategorized').astype(str)
    dataframe['unit'] = dataframe['unit'].fillna('Kg').astype(str)
    dataframe = dataframe.dropna(subset=['recorded_date', 'price_value', 'commodity_name'])
    dataframe['price_value'] = dataframe['price_value'].astype(float)

    return dataframe


def build_region_lookup(dataframe):
    region_names = dataframe['admin1'].dropna().astype(str).unique().tolist()

    if not region_names:
        return {}

    if 'National' in region_names:
        region_names = ['National'] + sorted([name for name in region_names if name != 'National'])
    else:
        region_names = sorted(region_names)

    return {name: index for index, name in enumerate(region_names, start=1)}


def seed_commodity_prices(force=False):
    if not force and CommodityPrice.query.count() > 0:
        return {'seeded': False, 'rows': CommodityPrice.query.count()}

    if force:
        db.session.query(CommodityPrice).delete()

    dataframe = load_dataset_dataframe()
    supported_frame = dataframe[dataframe['commodity_name'].isin(SUPPORTED_COMMODITIES)].copy()

    if supported_frame.empty:
        raise ValueError('Tidak ada data komoditas yang dapat disimpan ke SQLite.')

    region_lookup = build_region_lookup(supported_frame)
    supported_frame['region_id'] = supported_frame['admin1'].fillna('National').astype(str).map(region_lookup)
    supported_frame['region_id'] = supported_frame['region_id'].fillna(1).astype(int)
    supported_frame['price_type'] = 'retail'
    supported_frame['source'] = 'WFP CSV'
    supported_frame['unit'] = supported_frame['unit'].astype(str)
    supported_frame['recorded_date'] = pd.to_datetime(supported_frame['recorded_date']).dt.date

    records = supported_frame[
        [
            'commodity_name',
            'category',
            'region_id',
            'price_value',
            'unit',
            'price_type',
            'recorded_date',
            'source',
        ]
    ].to_dict(orient='records')

    db.session.bulk_insert_mappings(CommodityPrice, records)
    db.session.commit()

    return {'seeded': True, 'rows': len(records)}
