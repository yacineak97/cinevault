import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
import { Accounts } from 'meteor/accounts-base';

Meteor.methods({
  async 'users.insert'(username: string, password: string) {
    check(username, String);
    check(password, String);

    const existing = await Meteor.users.findOneAsync({ username });
    if (existing) throw new Meteor.Error('username-taken', 'Username already taken.');

    await Accounts.createUserAsync({ username, password });
  },
});
