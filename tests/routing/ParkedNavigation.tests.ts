import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    navigate,
    internalRoutes,
    clearPendingNavigations,
    registerRouteTarget,
    type Route,
} from '../../src/routing';
import { onError, RelaxError } from '../../src/errors';
import { flush } from '../../src/testing';

describe('Parked navigations', () => {
    const routes: Route[] = [
        { name: 'home', path: '/' },
        { name: 'modal', path: '/detail', target: 'modal' },
        { name: 'other-modal', path: '/other', target: 'modal' },
    ];

    let reported: RelaxError[];
    let previousHandler: unknown;

    beforeEach(() => {
        internalRoutes.length = 0;
        internalRoutes.push(...routes);
        clearPendingNavigations();
        history.replaceState({}, '', '/');
        reported = [];
        previousHandler = onError((error, ctx) => {
            reported.push(error);
            ctx.suppress();
        });
    });

    afterEach(() => {
        clearPendingNavigations();
        onError(previousHandler as never);
    });

    it('a_navigation_whose_target_never_connects_is_reported_instead_of_disappearing', async () => {
        registerRouteTarget('sidebar', () => {});

        navigate('modal');
        await flush();

        expect(reported).toHaveLength(1);
        expect(reported[0].message).toContain('modal');
        expect(reported[0].context.registeredTargets).toEqual(['sidebar']);
    });

    it('a_target_that_connects_in_the_same_task_claims_the_navigation_and_nothing_is_reported', async () => {
        navigate('modal');
        registerRouteTarget('modal', () => {});

        await flush();

        expect(reported).toHaveLength(0);
    });

    it('a_second_navigation_to_a_waiting_target_replaces_the_first_one_and_says_so', async () => {
        navigate('modal');
        navigate('other-modal');

        expect(reported.some((e) => e.message.includes('replaced'))).toBe(true);
        expect(reported.find((e) => e.message.includes('replaced'))!.context.discarded).toBe(
            'modal',
        );
    });

    it('clearing_pending_navigations_cancels_the_report_so_it_cannot_reach_a_later_test', async () => {
        navigate('modal');
        clearPendingNavigations();

        await flush();

        expect(reported).toHaveLength(0);
    });
});
