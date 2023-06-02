export type ListingExtractionDetails = {
  title: string;
  maxOccupancy: number;
  bedrooms: number;
  beds: number;
  baths: number;
  costPerNight: number;
  description: string;
  reviews?: number;
  lat: number;
  lng: number;
  thumbnail:string;
  type:string;
  roomType:string;
  photos: ListingGalleryExtraction[];
};

export type ListingExtractionHost = {
  id:string;
  firstName: string;
  lastName:string;
  about:string;
  listingsCount: number;
  totalListingsCount: number;
  pictureUrl: string;
  thumbnailUrl:string;
  createdAt:Date;
  revieweeCount:number;
  isSuperhost: boolean;
};

export type ListingGalleryExtraction = {
  ambient?: string;
  imageId?: string;
  origin?: string;
  objectKey?: string;
  caption?: string;
  width?:number;
  height?:number;
};

export type ListingReviewExtraction = {
  reviewId: string;
  title?: string;
  rating: number;
  date?: Date;
  author?: string;
  comment?: string;
  response?: string;
};

export type ListingAmbientExtraction = {
  name?: string;
};

export type ListingCalendarExtraction = {
  available: boolean;
  date: Date;
};

export type ListingSearchExtraction = {
  avgRating: number;
  isNew:boolean;
  coordinate?: { latitude: number; longitude: number };
  id: string;
  ref?:string;
  name: string;
  price: number;
  thumbnail?:string;
  hostId?:string;
};

export type AbnbListing = {
  listing: AbnbListingData;
};

export type VrboListing = {
  listing: VrboListingData;
};

export type AbnbListingData = {
  id: number;
  thumbnail_url:string;
  city: string;
  user_id: number;
  price: number;
  lat: number;
  lng: number;
  country: string;
  name: string;
  bathrooms: number;
  bedrooms: number;
  beds: number;
  min_nights: number;
  person_capacity: number;
  reviews_count: number;
  picture_count: number;
  description: string;
  room_type:string;
  property_type:string;
  room_type_category:string;
  photos: AbnbPhoto[];
  primary_host:AbnbHost;
  max_nights_input_value:number
};

export type VrboListingData = {
  id: number;
  thumbnail_url:string;
  city: string;
  price: number;
  lat: number;
  lng: number;
  country: string;
  name: string;
  bathrooms: number;
  bedrooms: number;
  beds: number;
  min_nights: number;
  person_capacity: number;
  reviews_count: number;
  picture_count: number;
  description: string;
  property_type:string;
  room_type_category:string;
  photos: VrboPhoto[];
};

export type AbnbHost={
  id: number;
  first_name: string;
  last_name:string;
  picture_url: string;
  thumbnail_url:string;
  created_at:string;
  reviewee_count:number;
  is_superhost: boolean;
}

export type AbnbPhoto = {
  xl_picture: string;
  picture: string;
  thumbnail: string;
  caption: string;
  sort_order: number;
  id: number;
};

export type VrboPhoto = {
  caption?:string;
  height:number;
  note?:string;
  uri:string;
  width:number;
  altText?:string;
};

export type AbnbReviews = {
  data: {
    merlin: {
      pdpReviews: {
        reviews: Review[];
      };
    };
  };
};

export type Review = {
  comments: string;
  id: string;
  createdAt: string;
  reviewer: Reviewer;
  rating: number;
  response: string;
};

export type Reviewer = {
  firstName: string;
  hostName: string;
  id: string;
  pictureUrl: string;
};

export type AbnbAvalibility = {
  calendar: {
    days: Day[];
  };
};

export type VrboAvalibility = {
  calendar: {
    days: Day[];
  };
};

export type Day = {
  available: boolean;
  date: string;
};

export type AbnbListingList = {
  user_promo_listings: UserListing[];
};

export type UserListing = {
  beds: number;
  bedrooms: number;
  bathrooms: number;
  id: number;
  id_str: string;
  instant_bookable: boolean;
  is_new_listing: boolean;
  is_superhost: boolean;
  localized_city: string;
  name: string;
  room_and_property_type: string;
  space_type: string;
  star_rating: number;
  visible_review_count: number;
  picture_url: string;
  nightly_price_as_guest: string;
  guest_currency: string;
  lat: number;
  lng: number;
};

export type User = {
  about: string;
  acceptance_rate: string;
  bookings: number;
  created_at: string;
  first_name: string;
  has_available_payout_info: boolean;
  has_profile_pic: boolean;
  id: number;
  identity_verified: boolean;
  listings_count: number;
  location: string;
  picture_url: string;
  picture_url_large: string;
  recommendation_count: number;
  response_rate: string;
  response_time: string;
  reviewee_count: number;
  school: string;
  thumbnail_medium_url: string;
  thumbnail_url: string;
  total_listings_count: number;
  trips: number;
  verification_labels: string[];
  verifications: string[];
  work: string;
};

export type AbnbUser = {
  user: User;
};
