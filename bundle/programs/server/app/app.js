Package["core-runtime"].queue("null",function () {/* Imports for global scope */

MongoInternals = Package.mongo.MongoInternals;
Mongo = Package.mongo.Mongo;
CollectionExtensions = Package.mongo.CollectionExtensions;
ReactiveVar = Package['reactive-var'].ReactiveVar;
Tracker = Package.tracker.Tracker;
Deps = Package.tracker.Deps;
ECMAScript = Package.ecmascript.ECMAScript;
Accounts = Package['accounts-base'].Accounts;
check = Package.check.check;
Match = Package.check.Match;
Meteor = Package.meteor.Meteor;
global = Package.meteor.global;
meteorEnv = Package.meteor.meteorEnv;
EmitterPromise = Package.meteor.EmitterPromise;
WebApp = Package.webapp.WebApp;
WebAppInternals = Package.webapp.WebAppInternals;
main = Package.webapp.main;
DDP = Package['ddp-client'].DDP;
DDPServer = Package['ddp-server'].DDPServer;
LaunchScreen = Package['launch-screen'].LaunchScreen;
meteorInstall = Package.modules.meteorInstall;
Promise = Package.promise.Promise;
Autoupdate = Package.autoupdate.Autoupdate;

var require = meteorInstall({"imports":{"api":{"moviesMethods.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// imports/api/moviesMethods.ts                                                            //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let check, Match;
    module.link("meteor/check", {
      check(v) {
        check = v;
      },
      Match(v) {
        Match = v;
      }
    }, 1);
    let MoviesCollection;
    module.link("../db/MoviesCollection", {
      MoviesCollection(v) {
        MoviesCollection = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Meteor.methods({
      async 'movies.insert'(title, author, description, genre, rating, year, poster) {
        check(title, String);
        check(author, String);
        check(description, String);
        check(genre, String);
        check(rating, Number);
        check(year, Match.Optional(Number));
        check(poster, Match.Optional(String));
        if (!this.userId) throw new Meteor.Error('not-authorized', 'Not authorized.');
        const user = await Meteor.users.findOneAsync({
          _id: this.userId
        });
        if (!user || user.username !== 'admin') {
          throw new Meteor.Error('not-authorized', 'Not authorized.');
        }
        await MoviesCollection.insertAsync({
          title,
          author,
          description,
          genre: genre,
          rating,
          year,
          poster,
          createdAt: new Date(),
          userId: this.userId
        });
      },
      async 'movies.remove'(movieId) {
        check(movieId, String);
        if (!this.userId) throw new Meteor.Error('not-authorized', 'Not authorized.');
        const user = await Meteor.users.findOneAsync({
          _id: this.userId
        });
        if (!user || user.username !== 'admin') {
          throw new Meteor.Error('not-authorized', 'Not authorized.');
        }
        const movie = await MoviesCollection.findOneAsync({
          _id: movieId
        });
        if (!movie) throw new Meteor.Error('not-found', 'Movie not found.');
        await MoviesCollection.removeAsync(movieId);
      }
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

},"moviesPublications.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// imports/api/moviesPublications.ts                                                       //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let MoviesCollection;
    module.link("/imports/db/MoviesCollection", {
      MoviesCollection(v) {
        MoviesCollection = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Meteor.publish('movies', function () {
      return MoviesCollection.find({});
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

},"usersMethods.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// imports/api/usersMethods.ts                                                             //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let check;
    module.link("meteor/check", {
      check(v) {
        check = v;
      }
    }, 1);
    let Accounts;
    module.link("meteor/accounts-base", {
      Accounts(v) {
        Accounts = v;
      }
    }, 2);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Meteor.methods({
      async 'users.insert'(username, password) {
        check(username, String);
        check(password, String);
        const existing = await Meteor.users.findOneAsync({
          username
        });
        if (existing) throw new Meteor.Error('username-taken', 'Username already taken.');
        await Accounts.createUserAsync({
          username,
          password
        });
      }
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

},"usersPublications.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// imports/api/usersPublications.ts                                                        //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    Meteor.publish('users', function () {
      return Meteor.users.find({}, {
        fields: {
          username: 1
        }
      });
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

}},"db":{"MoviesCollection.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// imports/db/MoviesCollection.ts                                                          //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.export({
      GENRES: () => GENRES,
      MoviesCollection: () => MoviesCollection
    });
    let Mongo;
    module.link("meteor/mongo", {
      Mongo(v) {
        Mongo = v;
      }
    }, 0);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const GENRES = ['Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Thriller', 'Western'];
    const MoviesCollection = new Mongo.Collection('movies');
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

}}},"server":{"seed.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// server/seed.ts                                                                          //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    let _objectSpread;
    module.link("@babel/runtime/helpers/objectSpread2", {
      default(v) {
        _objectSpread = v;
      }
    }, 0);
    let Meteor;
    module.link("meteor/meteor", {
      Meteor(v) {
        Meteor = v;
      }
    }, 0);
    let MoviesCollection;
    module.link("../imports/db/MoviesCollection", {
      MoviesCollection(v) {
        MoviesCollection = v;
      }
    }, 1);
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    const SEED_MOVIES = [{
      title: 'The Shawshank Redemption',
      author: 'Frank Darabont',
      description: 'Two imprisoned men bond over a number of years, finding solace and eventual redemption through acts of common decency. A timeless story of hope, friendship, and the enduring human spirit behind cold prison walls.',
      genre: 'Drama',
      rating: 4,
      year: 1994,
      poster: 'https://image.tmdb.org/t/p/w500/lyQBXzOQSuE59IsHyhrp0qIiPAz.jpg'
    }, {
      title: "Schindler's List",
      author: 'Steven Spielberg',
      description: 'In German-occupied Poland during World War II, industrialist Oskar Schindler gradually becomes concerned for his Jewish workforce after witnessing their persecution by the Nazis. A devastating and deeply moving masterpiece.',
      genre: 'Drama',
      rating: 4,
      year: 1993,
      poster: 'https://image.tmdb.org/t/p/w500/sF1U4EUQS8YHUYjNl3pMGNIQyr0.jpg'
    }, {
      title: 'Pulp Fiction',
      author: 'Quentin Tarantino',
      description: 'The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits interweave in four tales of violence and redemption in Los Angeles. A genre-defining landmark in independent cinema.',
      genre: 'Crime',
      rating: 4,
      year: 1994,
      poster: 'https://image.tmdb.org/t/p/w500/d5iIlFn5s0ImszYzBPb8JPIfbXD.jpg'
    }, {
      title: 'Spirited Away',
      author: 'Hayao Miyazaki',
      description: "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and monsters where humans are changed into beasts. A breathtaking work of imagination.",
      genre: 'Animation',
      rating: 4,
      year: 2001,
      poster: 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg'
    }, {
      title: 'Inception',
      author: 'Christopher Nolan',
      description: 'A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O. A mind-bending journey through layers of reality.',
      genre: 'Sci-Fi',
      rating: 4,
      year: 2010,
      poster: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg'
    }, {
      title: 'Interstellar',
      author: 'Christopher Nolan',
      description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival. An epic and emotionally resonant journey that tackles love, time, and the vastness of the cosmos.",
      genre: 'Sci-Fi',
      rating: 4,
      year: 2014,
      poster: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
    }, {
      title: 'Shutter Island',
      author: 'Martin Scorsese',
      description: 'In 1954, a U.S. Marshal investigates the disappearance of a murderer who escaped from a hospital for the criminally insane on a remote island. A deeply unsettling psychological thriller that questions the very nature of reality and sanity.',
      genre: 'Thriller',
      rating: 4,
      year: 2010,
      poster: 'https://www.themoviedb.org/t/p/w1280/lAH2HXxIjRWOrFVjwhBSsNr7yGW.jpg'
    }, {
      title: 'The Godfather',
      author: 'Francis Ford Coppola',
      description: 'The aging patriarch of an organized crime dynasty transfers control of his clandestine empire to his reluctant son. A sweeping saga of power, loyalty, and the American dream twisted into something darker.',
      genre: 'Crime',
      rating: 5,
      year: 1972,
      poster: 'https://image.tmdb.org/t/p/w500/eEslKSwcqmiNS6va24Pbxf2UKmJ.jpg'
    }];
    Meteor.startup(async () => {
      const count = await MoviesCollection.find().countAsync();
      if (count === 0) {
        for (const movie of SEED_MOVIES) {
          await MoviesCollection.insertAsync(_objectSpread(_objectSpread({}, movie), {}, {
            genre: movie.genre,
            createdAt: new Date(),
            userId: ''
          }));
        }
        console.log('✅ Seeded 8 movies into the database.');
      }
    });
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

},"main.ts":function module(require,exports,module){

/////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                         //
// server/main.ts                                                                          //
//                                                                                         //
/////////////////////////////////////////////////////////////////////////////////////////////
                                                                                           //
!module.wrapAsync(async function (module, __reifyWaitForDeps__, __reify_async_result__) {
  "use strict";
  try {
    module.link("../imports/api/usersMethods");
    module.link("../imports/api/moviesMethods");
    module.link("../imports/api/usersPublications");
    module.link("../imports/api/moviesPublications");
    module.link("./seed");
    if (__reifyWaitForDeps__()) (await __reifyWaitForDeps__())();
    __reify_async_result__();
  } catch (_reifyError) {
    return __reify_async_result__(_reifyError);
  }
  __reify_async_result__()
}, {
  self: this,
  async: false
});
/////////////////////////////////////////////////////////////////////////////////////////////

}}},{
  "extensions": [
    ".js",
    ".json",
    ".ts",
    ".mjs",
    ".tsx"
  ]
});


/* Exports */
return {
  require: require,
  eagerModulePaths: [
    "/server/main.ts"
  ]
}});

//# sourceURL=meteor://💻app/app/app.js
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvbW92aWVzTWV0aG9kcy50cyIsIm1ldGVvcjovL/CfkrthcHAvaW1wb3J0cy9hcGkvbW92aWVzUHVibGljYXRpb25zLnRzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2FwaS91c2Vyc01ldGhvZHMudHMiLCJtZXRlb3I6Ly/wn5K7YXBwL2ltcG9ydHMvYXBpL3VzZXJzUHVibGljYXRpb25zLnRzIiwibWV0ZW9yOi8v8J+Su2FwcC9pbXBvcnRzL2RiL01vdmllc0NvbGxlY3Rpb24udHMiLCJtZXRlb3I6Ly/wn5K7YXBwL3NlcnZlci9zZWVkLnRzIiwibWV0ZW9yOi8v8J+Su2FwcC9zZXJ2ZXIvbWFpbi50cyJdLCJuYW1lcyI6WyJNZXRlb3IiLCJtb2R1bGUiLCJsaW5rIiwidiIsImNoZWNrIiwiTWF0Y2giLCJNb3ZpZXNDb2xsZWN0aW9uIiwiX19yZWlmeVdhaXRGb3JEZXBzX18iLCJtZXRob2RzIiwibW92aWVzLmluc2VydCIsInRpdGxlIiwiYXV0aG9yIiwiZGVzY3JpcHRpb24iLCJnZW5yZSIsInJhdGluZyIsInllYXIiLCJwb3N0ZXIiLCJTdHJpbmciLCJOdW1iZXIiLCJPcHRpb25hbCIsInVzZXJJZCIsIkVycm9yIiwidXNlciIsInVzZXJzIiwiZmluZE9uZUFzeW5jIiwiX2lkIiwidXNlcm5hbWUiLCJpbnNlcnRBc3luYyIsImNyZWF0ZWRBdCIsIkRhdGUiLCJtb3ZpZXMucmVtb3ZlIiwibW92aWVJZCIsIm1vdmllIiwicmVtb3ZlQXN5bmMiLCJfX3JlaWZ5X2FzeW5jX3Jlc3VsdF9fIiwiX3JlaWZ5RXJyb3IiLCJzZWxmIiwiYXN5bmMiLCJwdWJsaXNoIiwiZmluZCIsIkFjY291bnRzIiwidXNlcnMuaW5zZXJ0IiwicGFzc3dvcmQiLCJleGlzdGluZyIsImNyZWF0ZVVzZXJBc3luYyIsImZpZWxkcyIsImV4cG9ydCIsIkdFTlJFUyIsIk1vbmdvIiwiQ29sbGVjdGlvbiIsIl9vYmplY3RTcHJlYWQiLCJkZWZhdWx0IiwiU0VFRF9NT1ZJRVMiLCJzdGFydHVwIiwiY291bnQiLCJjb3VudEFzeW5jIiwiY29uc29sZSIsImxvZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQUFBLElBQUFBLE1BQVM7SUFBQUMsTUFBUSxDQUFBQyxJQUFBLENBQU0sZUFBZSxFQUFDO01BQUFGLE9BQUFHLENBQUE7UUFBQUgsTUFBQSxHQUFBRyxDQUFBO01BQUE7SUFBQTtJQUFBLElBQUFDLEtBQUEsRUFBQUMsS0FBQTtJQUFBSixNQUFBLENBQUFDLElBQUE7TUFBQUUsTUFBQUQsQ0FBQTtRQUFBQyxLQUFBLEdBQUFELENBQUE7TUFBQTtNQUFBRSxNQUFBRixDQUFBO1FBQUFFLEtBQUEsR0FBQUYsQ0FBQTtNQUFBO0lBQUE7SUFBQSxJQUFBRyxnQkFBQTtJQUFBTCxNQUFBLENBQUFDLElBQUE7TUFBQUksaUJBQUFILENBQUE7UUFBQUcsZ0JBQUEsR0FBQUgsQ0FBQTtNQUFBO0lBQUE7SUFBQSxJQUFBSSxvQkFBQSxXQUFBQSxvQkFBQTtJQUl2Q1AsTUFBTSxDQUFDUSxPQUFPLENBQUM7TUFDYixNQUFNLGVBQWVDLENBQUNDLEtBQWEsRUFBRUMsTUFBYyxFQUFFQyxXQUFtQixFQUFFQyxLQUFhLEVBQUVDLE1BQWMsRUFBRUMsSUFBWSxFQUFFQyxNQUFlO1FBQ3BJWixLQUFLLENBQUNNLEtBQUssRUFBRU8sTUFBTSxDQUFDO1FBQ3BCYixLQUFLLENBQUNPLE1BQU0sRUFBRU0sTUFBTSxDQUFDO1FBQ3JCYixLQUFLLENBQUNRLFdBQVcsRUFBRUssTUFBTSxDQUFDO1FBQzFCYixLQUFLLENBQUNTLEtBQUssRUFBRUksTUFBTSxDQUFDO1FBQ3BCYixLQUFLLENBQUNVLE1BQU0sRUFBRUksTUFBTSxDQUFDO1FBQ3JCZCxLQUFLLENBQUNXLElBQUksRUFBRVYsS0FBSyxDQUFDYyxRQUFRLENBQUNELE1BQU0sQ0FBQyxDQUFDO1FBQ25DZCxLQUFLLENBQUNZLE1BQU0sRUFBRVgs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QyxNQUFNOUMsZ0JBQWdCLENBQUNxQixXQUFXLENBQUF1QixhQUFBLENBQUFBLGFBQUEsS0FDOUJsQixLQUFLO1lBQ1JuQixLQUFLLEVBQUVtQixLQUFLLENBQUNuQixLQUFZO1lBQ3pCZSxTQUFTLEVBQUUsSUFBSUMsSUFBSSxFQUFFO1lBQ3JCVCxNQUFNLEVBQUU7VUFBRSxFQUNWLENBQUM7UUFDSDtRQUNBb0MsT0FBTyxDQUFDQyxHQUFHLENBQUMsc0NBQXNDLENBQUM7TUFDcEQ7SUFDRCxDQUFDLENBQUM7SUFBQ3ZCLHNCQUFBO0VBQUEsU0FBQUMsV0FBQTtJQUFBLE9BQUFELHNCQUFBLENBQUFDLFdBQUE7RUFBQTtFQUFBRCxzQkFBQTtBQUFBO0VBQUFFLElBQUE7RUFBQUMsS0FBQTtBQUFBLEc7Ozs7Ozs7Ozs7Ozs7O0lDcEdIcEMsTUFBQSxDQUFPQyxJQUFBLDhCQUE4QjtJQUFBRCxNQUFBLENBQUFDLElBQUE7SUFBQUQsTUFBQSxDQUFBQyxJQUFBO0lBQUFELE1BQUEsQ0FBQUMsSUFBQTtJQUFBRCxNQUFBLENBQUFDLElBQUE7SUFBQSxJQUFBSyxvQkFBQSxXQUFBQSxvQkFBQTtJQUFBMkIsc0JBQUE7RUFBQSxTQUFBQyxXQUFBO0lBQUEsT0FBQUQsc0JBQUEsQ0FBQUMsV0FBQTtFQUFBO0VBQUFELHNCQUFBO0FBQUE7RUFBQUUsSUFBQTtFQUFBQyxLQUFBO0FBQUEsRyIsImZpbGUiOiIvYXBwLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBjaGVjaywgTWF0Y2ggfSBmcm9tICdtZXRlb3IvY2hlY2snO1xuaW1wb3J0IHsgTW92aWVzQ29sbGVjdGlvbiwgR0VOUkVTIH0gZnJvbSAnLi4vZGIvTW92aWVzQ29sbGVjdGlvbic7XG5cbk1ldGVvci5tZXRob2RzKHtcbiAgYXN5bmMgJ21vdmllcy5pbnNlcnQnKHRpdGxlOiBzdHJpbmcsIGF1dGhvcjogc3RyaW5nLCBkZXNjcmlwdGlvbjogc3RyaW5nLCBnZW5yZTogc3RyaW5nLCByYXRpbmc6IG51bWJlciwgeWVhcjogbnVtYmVyLCBwb3N0ZXI/OiBzdHJpbmcpIHtcbiAgICBjaGVjayh0aXRsZSwgU3RyaW5nKTtcbiAgICBjaGVjayhhdXRob3IsIFN0cmluZyk7XG4gICAgY2hlY2soZGVzY3JpcHRpb24sIFN0cmluZyk7XG4gICAgY2hlY2soZ2VucmUsIFN0cmluZyk7XG4gICAgY2hlY2socmF0aW5nLCBOdW1iZXIpO1xuICAgIGNoZWNrKHllYXIsIE1hdGNoLk9wdGlvbmFsKE51bWJlcikpO1xuICAgIGNoZWNrKHBvc3RlciwgTWF0Y2guT3B0aW9uYWwoU3RyaW5nKSk7XG5cbiAgICBpZiAoIXRoaXMudXNlcklkKSB0aHJvdyBuZXcgTWV0ZW9yLkVycm9yKCdub3QtYXV0aG9yaXplZCcsICdOb3QgYXV0aG9yaXplZC4nKTtcblxuICAgIGNvbnN0IHVzZXIgPSBhd2FpdCBNZXRlb3IudXNlcnMuZmluZE9uZUFzeW5jKHsgX2lkOiB0aGlzLnVzZXJJZCB9KTtcbiAgICBpZiAoIXVzZXIgfHwgdXNlci51c2VybmFtZSAhPT0gJ2FkbWluJykge1xuICAgICAgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQuJyk7XG4gICAgfVxuXG4gICAgYXdhaXQgTW92aWVzQ29sbGVjdGlvbi5pbnNlcnRBc3luYyh7XG4gICAgICB0aXRsZSxcbiAgICAgIGF1dGhvcixcbiAgICAgIGRlc2NyaXB0aW9uLFxuICAgICAgZ2VucmU6IGdlbnJlIGFzIGFueSxcbiAgICAgIHJhdGluZyxcbiAgICAgIHllYXIsXG4gICAgICBwb3N0ZXIsXG4gICAgICBjcmVhdGVkQXQ6IG5ldyBEYXRlKCksXG4gICAgICB1c2VySWQ6IHRoaXMudXNlcklkLFxuICAgIH0pO1xuICB9LFxuXG4gIGFzeW5jICdtb3ZpZXMucmVtb3ZlJyhtb3ZpZUlkOiBzdHJpbmcpIHtcbiAgICBjaGVjayhtb3ZpZUlkLCBTdHJpbmcpO1xuXG4gICAgaWYgKCF0aGlzLnVzZXJJZCkgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm90LWF1dGhvcml6ZWQnLCAnTm90IGF1dGhvcml6ZWQuJyk7XG5cbiAgICBjb25zdCB1c2VyID0gYXdhaXQgTWV0ZW9yLnVzZXJzLmZpbmRPbmVBc3luYyh7IF9pZDogdGhpcy51c2VySWQgfSk7XG4gICAgaWYgKCF1c2VyIHx8IHVzZXIudXNlcm5hbWUgIT09ICdhZG1pbicpIHtcbiAgICAgIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ25vdC1hdXRob3JpemVkJywgJ05vdCBhdXRob3JpemVkLicpO1xuICAgIH1cblxuICAgIGNvbnN0IG1vdmllID0gYXdhaXQgTW92aWVzQ29sbGVjdGlvbi5maW5kT25lQXN5bmMoeyBfaWQ6IG1vdmllSWQgfSk7XG4gICAgaWYgKCFtb3ZpZSkgdGhyb3cgbmV3IE1ldGVvci5FcnJvcignbm90LWZvdW5kJywgJ01vdmllIG5vdCBmb3VuZC4nKTtcblxuICAgIGF3YWl0IE1vdmllc0NvbGxlY3Rpb24ucmVtb3ZlQXN5bmMobW92aWVJZCk7XG4gIH0sXG59KTtcbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuaW1wb3J0IHsgTW92aWVzQ29sbGVjdGlvbiB9IGZyb20gJy9pbXBvcnRzL2RiL01vdmllc0NvbGxlY3Rpb24nO1xuXG5NZXRlb3IucHVibGlzaCgnbW92aWVzJywgZnVuY3Rpb24gKCkge1xuICByZXR1cm4gTW92aWVzQ29sbGVjdGlvbi5maW5kKHt9KTtcbn0pO1xuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBjaGVjayB9IGZyb20gJ21ldGVvci9jaGVjayc7XG5pbXBvcnQgeyBBY2NvdW50cyB9IGZyb20gJ21ldGVvci9hY2NvdW50cy1iYXNlJztcblxuTWV0ZW9yLm1ldGhvZHMoe1xuICBhc3luYyAndXNlcnMuaW5zZXJ0Jyh1c2VybmFtZTogc3RyaW5nLCBwYXNzd29yZDogc3RyaW5nKSB7XG4gICAgY2hlY2sodXNlcm5hbWUsIFN0cmluZyk7XG4gICAgY2hlY2socGFzc3dvcmQsIFN0cmluZyk7XG5cbiAgICBjb25zdCBleGlzdGluZyA9IGF3YWl0IE1ldGVvci51c2Vycy5maW5kT25lQXN5bmMoeyB1c2VybmFtZSB9KTtcbiAgICBpZiAoZXhpc3RpbmcpIHRocm93IG5ldyBNZXRlb3IuRXJyb3IoJ3VzZXJuYW1lLXRha2VuJywgJ1VzZXJuYW1lIGFscmVhZHkgdGFrZW4uJyk7XG5cbiAgICBhd2FpdCBBY2NvdW50cy5jcmVhdGVVc2VyQXN5bmMoeyB1c2VybmFtZSwgcGFzc3dvcmQgfSk7XG4gIH0sXG59KTtcbiIsImltcG9ydCB7IE1ldGVvciB9IGZyb20gJ21ldGVvci9tZXRlb3InO1xuXG5NZXRlb3IucHVibGlzaCgndXNlcnMnLCBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiBNZXRlb3IudXNlcnMuZmluZCh7fSwgeyBmaWVsZHM6IHsgdXNlcm5hbWU6IDEgfSB9KTtcbn0pO1xuIiwiaW1wb3J0IHsgTW9uZ28gfSBmcm9tICdtZXRlb3IvbW9uZ28nO1xuXG5leHBvcnQgY29uc3QgR0VOUkVTID0gW1xuICAnQWN0aW9uJywgJ0FkdmVudHVyZScsICdBbmltYXRpb24nLCAnQ29tZWR5JywgJ0NyaW1lJyxcbiAgJ0RvY3VtZW50YXJ5JywgJ0RyYW1hJywgJ0ZhbnRhc3knLCAnSG9ycm9yJywgJ015c3RlcnknLFxuICAnUm9tYW5jZScsICdTY2ktRmknLCAnVGhyaWxsZXInLCAnV2VzdGVybicsXG5dIGFzIGNvbnN0O1xuXG5leHBvcnQgdHlwZSBHZW5yZSA9IHR5cGVvZiBHRU5SRVNbbnVtYmVyXTtcblxuZXhwb3J0IGludGVyZmFjZSBNb3ZpZSB7XG4gIF9pZD86IHN0cmluZztcbiAgdGl0bGU6IHN0cmluZztcbiAgYXV0aG9yOiBzdHJpbmc7XG4gIGRlc2NyaXB0aW9uOiBzdHJpbmc7XG4gIGdlbnJlOiBHZW5yZTtcbiAgcmF0aW5nOiBudW1iZXI7XG4gIHllYXI/OiBudW1iZXI7XG4gIHBvc3Rlcj86IHN0cmluZztcbiAgY3JlYXRlZEF0OiBEYXRlO1xuICB1c2VySWQ6IHN0cmluZztcbn1cblxuZXhwb3J0IGNvbnN0IE1vdmllc0NvbGxlY3Rpb24gPSBuZXcgTW9uZ28uQ29sbGVjdGlvbjxNb3ZpZT4oJ21vdmllcycpO1xuIiwiaW1wb3J0IHsgTWV0ZW9yIH0gZnJvbSAnbWV0ZW9yL21ldGVvcic7XG5pbXBvcnQgeyBNb3ZpZXNDb2xsZWN0aW9uIH0gZnJvbSAnLi4vaW1wb3J0cy9kYi9Nb3ZpZXNDb2xsZWN0aW9uJztcblxuY29uc3QgU0VFRF9NT1ZJRVMgPSBbXG5cdHtcblx0XHR0aXRsZTogJ1RoZSBTaGF3c2hhbmsgUmVkZW1wdGlvbicsXG5cdFx0YXV0aG9yOiAnRnJhbmsgRGFyYWJvbnQnLFxuXHRcdGRlc2NyaXB0aW9uOlxuXHRcdFx0J1R3byBpbXByaXNvbmVkIG1lbiBib25kIG92ZXIgYSBudW1iZXIgb2YgeWVhcnMsIGZpbmRpbmcgc29sYWNlIGFuZCBldmVudHVhbCByZWRlbXB0aW9uIHRocm91Z2ggYWN0cyBvZiBjb21tb24gZGVjZW5jeS4gQSB0aW1lbGVzcyBzdG9yeSBvZiBob3BlLCBmcmllbmRzaGlwLCBhbmQgdGhlIGVuZHVyaW5nIGh1bWFuIHNwaXJpdCBiZWhpbmQgY29sZCBwcmlzb24gd2FsbHMuJyxcblx0XHRnZW5yZTogJ0RyYW1hJyxcblx0XHRyYXRpbmc6IDQsXG5cdFx0eWVhcjogMTk5NCxcblx0XHRwb3N0ZXI6ICdodHRwczovL2ltYWdlLnRtZGIub3JnL3QvcC93NTAwL2x5UUJYek9RU3VFNTlJc0h5aHJwMHFJaVBBei5qcGcnLFxuXHR9LFxuXHR7XG5cdFx0dGl0bGU6IFwiU2NoaW5kbGVyJ3MgTGlzdFwiLFxuXHRcdGF1dGhvcjogJ1N0ZXZlbiBTcGllbGJlcmcnLFxuXHRcdGRlc2NyaXB0aW9uOlxuXHRcdFx0J0luIEdlcm1hbi1vY2N1cGllZCBQb2xhbmQgZHVyaW5nIFdvcmxkIFdhciBJSSwgaW5kdXN0cmlhbGlzdCBPc2thciBTY2hpbmRsZXIgZ3JhZHVhbGx5IGJlY29tZXMgY29uY2VybmVkIGZvciBoaXMgSmV3aXNoIHdvcmtmb3JjZSBhZnRlciB3aXRuZXNzaW5nIHRoZWlyIHBlcnNlY3V0aW9uIGJ5IHRoZSBOYXppcy4gQSBkZXZhc3RhdGluZyBhbmQgZGVlcGx5IG1vdmluZyBtYXN0ZXJwaWVjZS4nLFxuXHRcdGdlbnJlOiAnRHJhbWEnLFxuXHRcdHJhdGluZzogNCxcblx0XHR5ZWFyOiAxOTkzLFxuXHRcdHBvc3RlcjogJ2h0dHBzOi8vaW1hZ2UudG1kYi5vcmcvdC9wL3c1MDAvc0YxVTRFVVFTOFlIVVlqTmwzcE1HTklReXIwLmpwZycsXG5cdH0sXG5cdHtcblx0XHR0aXRsZTogJ1B1bHAgRmljdGlvbicsXG5cdFx0YXV0aG9yOiAnUXVlbnRpbiBUYXJhbnRpbm8nLFxuXHRcdGRlc2NyaXB0aW9uOlxuXHRcdFx0J1RoZSBsaXZlcyBvZiB0d28gbW9iIGhpdG1lbiwgYSBib3hlciwgYSBnYW5nc3RlciBhbmQgaGlzIHdpZmUsIGFuZCBhIHBhaXIgb2YgZGluZXIgYmFuZGl0cyBpbnRlcndlYXZlIGluIGZvdXIgdGFsZXMgb2YgdmlvbGVuY2UgYW5kIHJlZGVtcHRpb24gaW4gTG9zIEFuZ2VsZXMuIEEgZ2VucmUtZGVmaW5pbmcgbGFuZG1hcmsgaW4gaW5kZXBlbmRlbnQgY2luZW1hLicsXG5cdFx0Z2VucmU6ICdDcmltZScsXG5cdFx0cmF0aW5nOiA0LFxuXHRcdHllYXI6IDE5OTQsXG5cdFx0cG9zdGVyOiAnaHR0cHM6Ly9pbWFnZS50bWRiLm9yZy90L3AvdzUwMC9kNWlJbEZuNXMwSW1zell6QlBiOEpQSWZiWEQuanBnJyxcblx0fSxcblx0e1xuXHRcdHRpdGxlOiAnU3Bpcml0ZWQgQXdheScsXG5cdFx0YXV0aG9yOiAnSGF5YW8gTWl5YXpha2knLFxuXHRcdGRlc2NyaXB0aW9uOlxuXHRcdFx0XCJEdXJpbmcgaGVyIGZhbWlseSdzIG1vdmUgdG8gdGhlIHN1YnVyYnMsIGEgc3VsbGVuIDEwLXllYXItb2xkIGdpcmwgd2FuZGVycyBpbnRvIGEgd29ybGQgcnVsZWQgYnkgZ29kcywgd2l0Y2hlcywgYW5kIG1vbnN0ZXJzIHdoZXJlIGh1bWFucyBhcmUgY2hhbmdlZCBpbnRvIGJlYXN0cy4gQSBicmVhdGh0YWtpbmcgd29yayBvZiBpbWFnaW5hdGlvbi5cIixcblx0XHRnZW5yZTogJ0FuaW1hdGlvbicsXG5cdFx0cmF0aW5nOiA0LFxuXHRcdHllYXI6IDIwMDEsXG5cdFx0cG9zdGVyOiAnaHR0cHM6Ly9pbWFnZS50bWRiLm9yZy90L3AvdzUwMC8zOXdtSXRJV3NnNXNaTXlSVUhMa1dCY3VWQ00uanBnJyxcblx0fSxcblx0e1xuXHRcdHRpdGxlOiAnSW5jZXB0aW9uJyxcblx0XHRhdXRob3I6ICdDaHJpc3RvcGhlciBOb2xhbicsXG5cdFx0ZGVzY3JpcHRpb246XG5cdFx0XHQnQSB0aGllZiB3aG8gc3RlYWxzIGNvcnBvcmF0ZSBzZWNyZXRzIHRocm91Z2ggdGhlIHVzZSBvZiBkcmVhbS1zaGFyaW5nIHRlY2hub2xvZ3kgaXMgZ2l2ZW4gdGhlIGludmVyc2UgdGFzayBvZiBwbGFudGluZyBhbiBpZGVhIGludG8gdGhlIG1pbmQgb2YgYSBDLkUuTy4gQSBtaW5kLWJlbmRpbmcgam91cm5leSB0aHJvdWdoIGxheWVycyBvZiByZWFsaXR5LicsXG5cdFx0Z2VucmU6ICdTY2ktRmknLFxuXHRcdHJhdGluZzogNCxcblx0XHR5ZWFyOiAyMDEwLFxuXHRcdHBvc3RlcjogJ2h0dHBzOi8vaW1hZ2UudG1kYi5vcmcvdC9wL3c1MDAvb1l1TEV0M3pWQ0txNTdxdTJGOGRUN05JYTZmLmpwZycsXG5cdH0sXG5cdHtcblx0XHR0aXRsZTogJ0ludGVyc3RlbGxhcicsXG5cdFx0YXV0aG9yOiAnQ2hyaXN0b3BoZXIgTm9sYW4nLFxuXHRcdGRlc2NyaXB0aW9uOlxuXHRcdFx0XCJBIHRlYW0gb2YgZXhwbG9yZXJzIHRyYXZlbCB0aHJvdWdoIGEgd29ybWhvbGUgaW4gc3BhY2UgaW4gYW4gYXR0ZW1wdCB0byBlbnN1cmUgaHVtYW5pdHkncyBzdXJ2aXZhbC4gQW4gZXBpYyBhbmQgZW1vdGlvbmFsbHkgcmVzb25hbnQgam91cm5leSB0aGF0IHRhY2tsZXMgbG92ZSwgdGltZSwgYW5kIHRoZSB2YXN0bmVzcyBvZiB0aGUgY29zbW9zLlwiLFxuXHRcdGdlbnJlOiAnU2NpLUZpJyxcblx0XHRyYXRpbmc6IDQsXG5cdFx0eWVhcjogMjAxNCxcblx0XHRwb3N0ZXI6ICdodHRwczovL2ltYWdlLnRtZGIub3JnL3QvcC93NTAwL2dFVTJRbmlFNkU3N05JNmxDVTZNeGxOQnZJeC5qcGcnLFxuXHR9LFxuXHR7XG5cdFx0dGl0bGU6ICdTaHV0dGVyIElzbGFuZCcsXG5cdFx0YXV0aG9yOiAnTWFydGluIFNjb3JzZXNlJyxcblx0XHRkZXNjcmlwdGlvbjpcblx0XHRcdCdJbiAxOTU0LCBhIFUuUy4gTWFyc2hhbCBpbnZlc3RpZ2F0ZXMgdGhlIGRpc2FwcGVhcmFuY2Ugb2YgYSBtdXJkZXJlciB3aG8gZXNjYXBlZCBmcm9tIGEgaG9zcGl0YWwgZm9yIHRoZSBjcmltaW5hbGx5IGluc2FuZSBvbiBhIHJlbW90ZSBpc2xhbmQuIEEgZGVlcGx5IHVuc2V0dGxpbmcgcHN5Y2hvbG9naWNhbCB0aHJpbGxlciB0aGF0IHF1ZXN0aW9ucyB0aGUgdmVyeSBuYXR1cmUgb2YgcmVhbGl0eSBhbmQgc2FuaXR5LicsXG5cdFx0Z2VucmU6ICdUaHJpbGxlcicsXG5cdFx0cmF0aW5nOiA0LFxuXHRcdHllYXI6IDIwMTAsXG5cdFx0cG9zdGVyOlxuXHRcdFx0J2h0dHBzOi8vd3d3LnRoZW1vdmllZGIub3JnL3QvcC93MTI4MC9sQUgySFh4SWpSV09yRlZqd2hCU3NOcjd5R1cuanBnJyxcblx0fSxcblx0e1xuXHRcdHRpdGxlOiAnVGhlIEdvZGZhdGhlcicsXG5cdFx0YXV0aG9yOiAnRnJhbmNpcyBGb3JkIENvcHBvbGEnLFxuXHRcdGRlc2NyaXB0aW9uOlxuXHRcdFx0J1RoZSBhZ2luZyBwYXRyaWFyY2ggb2YgYW4gb3JnYW5pemVkIGNyaW1lIGR5bmFzdHkgdHJhbnNmZXJzIGNvbnRyb2wgb2YgaGlzIGNsYW5kZXN0aW5lIGVtcGlyZSB0byBoaXMgcmVsdWN0YW50IHNvbi4gQSBzd2VlcGluZyBzYWdhIG9mIHBvd2VyLCBsb3lhbHR5LCBhbmQgdGhlIEFtZXJpY2FuIGRyZWFtIHR3aXN0ZWQgaW50byBzb21ldGhpbmcgZGFya2VyLicsXG5cdFx0Z2VucmU6ICdDcmltZScsXG5cdFx0cmF0aW5nOiA1LFxuXHRcdHllYXI6IDE5NzIsXG5cdFx0cG9zdGVyOiAnaHR0cHM6Ly9pbWFnZS50bWRiLm9yZy90L3AvdzUwMC9lRXNsS1N3Y3FtaU5TNnZhMjRQYnhmMlVLbUouanBnJyxcblx0fSxcbl07XG5cbk1ldGVvci5zdGFydHVwKGFzeW5jICgpID0+IHtcblx0Y29uc3QgY291bnQgPSBhd2FpdCBNb3ZpZXNDb2xsZWN0aW9uLmZpbmQoKS5jb3VudEFzeW5jKCk7XG5cdGlmIChjb3VudCA9PT0gMCkge1xuXHRcdGZvciAoY29uc3QgbW92aWUgb2YgU0VFRF9NT1ZJRVMpIHtcblx0XHRcdGF3YWl0IE1vdmllc0NvbGxlY3Rpb24uaW5zZXJ0QXN5bmMoe1xuXHRcdFx0XHQuLi5tb3ZpZSxcblx0XHRcdFx0Z2VucmU6IG1vdmllLmdlbnJlIGFzIGFueSxcblx0XHRcdFx0Y3JlYXRlZEF0OiBuZXcgRGF0ZSgpLFxuXHRcdFx0XHR1c2VySWQ6ICcnLFxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGNvbnNvbGUubG9nKCfinIUgU2VlZGVkIDggbW92aWVzIGludG8gdGhlIGRhdGFiYXNlLicpO1xuXHR9XG59KTtcbiIsImltcG9ydCAnLi4vaW1wb3J0cy9hcGkvdXNlcnNNZXRob2RzJztcclxuaW1wb3J0ICcuLi9pbXBvcnRzL2FwaS9tb3ZpZXNNZXRob2RzJztcclxuaW1wb3J0ICcuLi9pbXBvcnRzL2FwaS91c2Vyc1B1YmxpY2F0aW9ucyc7XHJcbmltcG9ydCAnLi4vaW1wb3J0cy9hcGkvbW92aWVzUHVibGljYXRpb25zJztcclxuaW1wb3J0ICcuL3NlZWQnO1xyXG4iXX0=
