import { App } from './ui/app';

const root = document.getElementById('app');
if (!root) throw new Error('#app container missing');
new App(root);
