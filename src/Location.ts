import { Polygon } from "geojson";
import { BeforeInsert, Column, Entity } from "typeorm";
import { DatabaseEntity } from "./DatabaseEntity";
import { LocationGeoLevel } from "./enums";


@Entity()
export class Location extends DatabaseEntity {
  @Column()
  locationTitle: string;

  @Column()
  locationSearchString: string;

  @Column()
  includeOnSearch: boolean; // To exclude giant polygons from search

  @Column()
  includeOnCronJobs: boolean; // To include polygon in scheduled extractions

  @Column({
    nullable: true,
    type: "geometry",
    spatialFeatureType: "Polygon",
    srid: 4326,
  })
  polygon: Polygon;

  @Column("enum", { enum: LocationGeoLevel })
  polygonGeoLevel: LocationGeoLevel;

  @Column()
  country:string;

  @BeforeInsert()
  setCountry() {
    this.country = process.env.country;
  }
}

export type LocationDto = Partial<Location>;
