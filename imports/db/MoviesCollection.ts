import { Mongo } from 'meteor/mongo';

export const GENRES = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime',
  'Documentary', 'Drama', 'Fantasy', 'Horror', 'Mystery',
  'Romance', 'Sci-Fi', 'Thriller', 'Western',
] as const;

export type Genre = typeof GENRES[number];

export interface Movie {
  _id?: string;
  title: string;
  author: string;
  description: string;
  genre: Genre;
  rating: number;
  year?: number;
  poster?: string;
  createdAt: Date;
  userId: string;
}

export const MoviesCollection = new Mongo.Collection<Movie>('movies');
