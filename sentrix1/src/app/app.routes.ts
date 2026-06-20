import { Routes } from '@angular/router';
import { Landing } from './landing/landing';
import { Insights } from './insights/insights';
import { Test1 } from './test1/test1';
import { Helmet } from './helmet/helmet';
import { Helmet2 } from './helmet2/helmet2';

export const routes: Routes = [
    {
        path: '',
        component: Landing
    },
    {
        path: 'insights',
        component: Insights
    },
    {
        path: 'test1',
        component: Test1
    },
    {
        path: 'helmet',
        component: Helmet
    },
    {
        path: 'helmet2',
        component: Helmet2
    }
];
