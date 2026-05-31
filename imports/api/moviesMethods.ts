import { Meteor } from 'meteor/meteor';
import { check, Match } from 'meteor/check';
import { MoviesCollection, GENRES } from '../db/MoviesCollection';

Meteor.methods({
  async 'movies.insert'(title: string, author: string, description: string, genre: string, rating: number, year: number, poster?: string) {
    check(title, String);
    check(author, String);
    check(description, String);
    check(genre, String);
    check(rating, Number);
    check(year, Match.Optional(Number));
    check(poster, Match.Optional(String));

    if (!this.userId) throw new Meteor.Error('not-authorized', 'Not authorized.');

    const user = await Meteor.users.findOneAsync({ _id: this.userId });
    if (!user || user.username !== 'admin') {
      throw new Meteor.Error('not-authorized', 'Not authorized.');
    }

    await MoviesCollection.insertAsync({
      title,
      author,
      description,
      genre: genre as any,
      rating,
      year,
      poster,
      createdAt: new Date(),
      userId: this.userId,
    });
  },

  async 'movies.remove'(movieId: string) {
    check(movieId, String);

    if (!this.userId) throw new Meteor.Error('not-authorized', 'Not authorized.');

    const user = await Meteor.users.findOneAsync({ _id: this.userId });
    if (!user || user.username !== 'admin') {
      throw new Meteor.Error('not-authorized', 'Not authorized.');
    }

    const movie = await MoviesCollection.findOneAsync({ _id: movieId });
    if (!movie) throw new Meteor.Error('not-found', 'Movie not found.');

    await MoviesCollection.removeAsync(movieId);
  },
});
