import { Accounts } from 'meteor/accounts-base';

Accounts.onLogin(function () {
	const token = Accounts._storedLoginToken();
	if (token) {
		localStorage.setItem('Meteor.loginToken', token);
	}
});

Accounts.onLogout(function () {
	localStorage.removeItem('Meteor.loginToken');
});
