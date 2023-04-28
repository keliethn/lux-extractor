export enum ListingSource{
    AirBnB="airbnb",
    VRBO="vrbo",
    NONE="none",
    ANY="any"
}

export enum ElementToExtract{
    singleListing="singleListing",
    multipleListing="multipleListing",
    user="user",
    reviews="reviews",
    details="details",
    gallery="gallery",
    calendar="calendar",
    search="search",
    none="none",
    lookup="lookup"
}

export enum LocationGeoLevel{
    State_Province_Department,
    County_Municiple,
    Community,
    Place,
    Country
}