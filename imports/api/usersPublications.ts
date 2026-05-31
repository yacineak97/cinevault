import { Meteor } from 'meteor/meteor';

Meteor.publish('users', function () {
  return Meteor.users.find({}, { fields: { username: 1 } });
});
