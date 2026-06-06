#!/usr/bin/env python
import sys
sys.path.insert(0, 'c:\\Users\\SALWA\\Documents\\GitHub\\WAREG')

from app import create_app

# Create app context
app = create_app()

with app.app_context():
    from app.services.predictor import get_market_comparison
    
    # Test endpoint with region_id=27 (Kota Bandung), commodity=Chili (Red)
    result = get_market_comparison(region_id=27, commodity='Chili (Red)')
    
    print("=== ENDPOINT RESPONSE ===")
    print(f"Commodity: {result.get('commodity')}")
    print(f"Region ID: {result.get('region_id')}")
    print(f"Province: {result.get('province')}")
    print(f"Recommendation: {result.get('recommendation')}")
    print(f"Recommendations count: {len(result.get('recommendations', []))}")
    
    if result.get('recommendations'):
        print("\nRecommendations:")
        for rec in result['recommendations']:
            print(f"  - {rec['market']}: {rec['predicted_price']}")
    else:
        print("\n⚠️  No recommendations in response!")
