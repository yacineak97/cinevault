import React from 'react';
import { createRoot } from 'react-dom/client';
import { Meteor } from 'meteor/meteor';
import './keep-logged-in';
import './main.css';
import { App } from '../imports/ui/App';

Meteor.startup(() => {
	const container = document.createElement('div');
	container.id = 'react-root';
	document.body.appendChild(container);
	const root = createRoot(container);
	root.render(<App />);
});
