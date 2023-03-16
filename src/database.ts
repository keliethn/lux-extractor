import { DataSource } from "typeorm";
import dotenv from "dotenv";
import * as path from "path";
import { Location } from "./Location";

dotenv.config({
  path: path.join(__dirname, "./config.env"),
});

/**
 * Database initialization
 */


export const AppDataSource = new DataSource({
  type: "postgres",
  host: `${process.env.dbhost}`,
  port: parseInt(process.env.dbport),
  database: `${process.env.dbname}`,
  username: `${process.env.dbuser}`,
  password: `${process.env.dbpass}`,
  entities: [Location],
  synchronize: true,
  logging: false,
});

