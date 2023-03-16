import { instanceToPlain, Exclude } from 'class-transformer';
import { BaseEntity, CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export abstract class DatabaseEntity extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id: string;
  
    @Exclude()
    @CreateDateColumn()
    createdAt: Date;
  
    @Exclude()
    @UpdateDateColumn()
    updatedAt: Date;
  
    toJSON() {
      return instanceToPlain(this);
    }
  }