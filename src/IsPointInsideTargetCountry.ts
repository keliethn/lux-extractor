import { Point } from "geojson";
import isPointInPolygon from "geolib/es/isPointInPolygon";
import { GeolibInputCoordinates } from "geolib/es/types";
import { AppDataSource } from "./database";
import { LocationGeoLevel } from "./enums";
import { Location } from "./Location";
export async function IsPointInsideTargetCountry(point: Point,countries:Location[]) {
 
    let counter = 0;
    let pt: GeolibInputCoordinates = [point.coordinates[0], point.coordinates[1]];
    

   //
    
  
    for (const loc of countries) {
      let current = loc.polygon.coordinates[0].map((x) => {
        let p: GeolibInputCoordinates = [x[0], x[1]];
        return p;
      });
  
      if (isPointInPolygon(pt, current)) {
        counter++;
      }
    }
  
    return counter>0?true:false
  }
  