export enum ListingSource{
    AirBnB="airbnb",
    VRBO="vrbo",
    NONE="none",
    ANY="any"
}

export enum ElementToExtract{
    VRBO_LISTING="VRBO",
    HOST="HOST",
    REVIEWS="REVIEWS",
    LISTING="LISTING",
    GALLERY="GALLERY",
    CALENDAR="CALENDAR",
    SEARCH="SEARCH",
    PRICE_RANGE_LOOKUP="LOOKUP",
    ERROR="ERROR",
    NOT_FOUND="404"
}

export enum LocationGeoLevel{
    State_Province_Department,
    County_Municiple,
    Community,
    Place,
    Country
}