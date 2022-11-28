export interface Listing {
    unitId: string;
    sessionId: string;
    provider: string;
    providerId:string;
    requestId: string;
    instance: string;
    details: ListingExtractionDetails;
    gallery: ListingExtractionGallery;
    reviews: ListingExtractionReviews;
    ambients: ListingExtractionAmbients;
}

export interface ListingExtractionDetails {
    provider: DataSource,
    providerId:string,
    unitName:string,
    maxOccupancy: number,
    bedrooms: number,
    beds: number,
    baths: number,
    costPerNight: number,
    description: string
}

export interface ListingExtractionGallery {
    count: number,
    provider: DataSource,
    providerId:string,
    userId:string,
    images: ListingGalleryExtractionDto[]
}

export interface ListingExtractionReviews {
    count: number,
    provider: DataSource,
    providerId:string,
    items: ListingReviewExtractionDto[]
}

export interface ListingExtractionAmbients {
    count: number,
    provider: DataSource,
    providerId:string,
    items: ListingAmbientExtractionDto[]
}

export type ListingGalleryExtractionDto = {
    provider:DataSource,
    providerId:string,
    ambient?: string;
    imageId?: string;
    url?: string;
    localId?: string;
    cloudUrl?: string
    caption?: string;
}

export type ListingReviewExtractionDto={
    provider:DataSource,
    providerId:string,
    reviewId:string;
    title:string;
    rating:number;
    date?:Date
    author?: string;
    comment?: string;
    response?:string;
}

export type ListingAmbientExtractionDto = {
    provider:DataSource,
    providerId:string,
    name?: string;
}

export enum DataSource{
    AirBnB="airbnb",
    VRBO="vrbo",
    NONE="none",
    ANY="any"
}