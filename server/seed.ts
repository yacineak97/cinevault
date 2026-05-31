import { Meteor } from 'meteor/meteor';
import { MoviesCollection } from '../imports/db/MoviesCollection';

const SEED_MOVIES = [
	{
		title: 'The Shawshank Redemption',
		author: 'Frank Darabont',
		description:
			'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency. A timeless story of hope, friendship, and the enduring human spirit behind cold prison walls.',
		genre: 'Drama',
		rating: 4,
		year: 1994,
		poster: 'https://image.tmdb.org/t/p/w500/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg',
	},
	{
		title: "Schindler's List",
		author: 'Steven Spielberg',
		description:
			'In German-occupied Poland during World War II, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce after witnessing their persecution by the Nazis. A devastating and deeply moving masterpiece.',
		genre: 'Drama',
		rating: 4,
		year: 1993,
		poster: 'https://image.tmdb.org/t/p/w500/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg',
	},
	{
		title: 'Pulp Fiction',
		author: 'Quentin Tarantino',
		description:
			'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits interweave in four tales of violence and redemption in Los Angeles. A genre-defining landmark in independent cinema.',
		genre: 'Crime',
		rating: 4,
		year: 1994,
		poster: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg',
	},
	{
		title: 'Spirited Away',
		author: 'Hayao Miyazaki',
		description:
			"During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and monsters where humans are changed into beasts. A breathtaking work of imagination.",
		genre: 'Animation',
		rating: 4,
		year: 2001,
		poster: 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
	},
	{
		title: 'Inception',
		author: 'Christopher Nolan',
		description:
			'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O. A mind-bending journey through layers of reality.',
		genre: 'Sci-Fi',
		rating: 4,
		year: 2010,
		poster: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg',
	},
	{
		title: 'Interstellar',
		author: 'Christopher Nolan',
		description:
			"A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival. An epic and emotionally resonant journey that tackles love, time, and the vastness of the cosmos.",
		genre: 'Sci-Fi',
		rating: 4,
		year: 2014,
		poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
	},
	{
		title: 'Shutter Island',
		author: 'Martin Scorsese',
		description:
			'In 1954, a U.S. Marshal investigates the disappearance of a murderer who escaped from a hospital for the criminally insane on a remote island. A deeply unsettling psychological thriller that questions the very nature of reality and sanity.',
		genre: 'Thriller',
		rating: 4,
		year: 2010,
		poster:
			'https://www.themoviedb.org/t/p/w1280/lAH2HXxIjRWOrFVjwhBSsNr7yGW.jpg',
	},
	{
		title: 'The Godfather',
		author: 'Francis Ford Coppola',
		description:
			'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son. A sweeping saga of power, loyalty, and the American dream twisted into something darker.',
		genre: 'Crime',
		rating: 5,
		year: 1972,
		poster: 'https://image.tmdb.org/t/p/w500/eEslKSwcqmiNS6va24Pbxf2UKmJ.jpg',
	},
];

Meteor.startup(async () => {
	const count = await MoviesCollection.find().countAsync();
	if (count === 0) {
		for (const movie of SEED_MOVIES) {
			await MoviesCollection.insertAsync({
				...movie,
				genre: movie.genre as any,
				createdAt: new Date(),
				userId: '',
			});
		}
		console.log('✅ Seeded 8 movies into the database.');
	}
});
