import { describe, it, expect, beforeEach } from 'vitest';
import {
    navigate,
    NavigateRouteEvent,
    Route,
    RouteGuard,
    GuardResult,
    RouteMatchResult,
    RouteGuardError,
    startRouting,
    defineRoutes
} from '../../src/routing';

class AllowGuard implements RouteGuard {
    check(_route: RouteMatchResult): GuardResult {
        return GuardResult.Allow;
    }
}

class DenyGuard implements RouteGuard {
    check(_route: RouteMatchResult): GuardResult {
        return GuardResult.Deny;
    }
}

class ContinueGuard implements RouteGuard {
    check(_route: RouteMatchResult): GuardResult {
        return GuardResult.Continue;
    }
}

class SpyGuard implements RouteGuard {
    callCount = 0;
    result: GuardResult;
    
    constructor(result: GuardResult) {
        this.result = result;
    }
    
    check(_route: RouteMatchResult): GuardResult {
        this.callCount++;
        return this.result;
    }
}

describe('Route Guards', () => {
    let routes: Route[];

    beforeEach(() => {
        window.location.pathname = '/';
        routes = [
            { 
                name: 'default', 
                path: '',
                guards: [] 
            },
            { 
                name: 'unguarded', 
                path: '/unguarded',
                guards: [] 
            },
            { 
                name: 'allow', 
                path: '/allow',
                guards: [new AllowGuard()] 
            },
            { 
                name: 'deny', 
                path: '/deny',
                guards: [new DenyGuard()] 
            },
            { 
                name: 'continue', 
                path: '/continue',
                guards: [new ContinueGuard()] 
            },
            { 
                name: 'chainAllow', 
                path: '/chain-allow',
                guards: [new ContinueGuard(), new AllowGuard()] 
            },
            { 
                name: 'chainDeny', 
                path: '/chain-deny',
                guards: [new ContinueGuard(), new DenyGuard()] 
            }
        ];
    });

    it('should allow navigation when guard returns Allow', () => {
        let capturedEvent: NavigateRouteEvent | null = null;
        document.addEventListener('rlx.navigateRoute', (e) => {
            capturedEvent = e;
        });

        navigate('allow', { routes });
        
        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent!.route.name).toBe('allow');
    });

    it('should throw RouteGuardError when guard returns Deny', () => {
        expect(() => navigate('deny', { routes }))
            .toThrow(RouteGuardError);
    });

    it('should process multiple guards in sequence until Allow', () => {
        const spyGuard1 = new SpyGuard(GuardResult.Continue);
        const spyGuard2 = new SpyGuard(GuardResult.Allow);
        const spyGuard3 = new SpyGuard(GuardResult.Continue);
        
        const testRoutes: Route[] = [
            { 
                name: 'spy', 
                path: '/spy',
                guards: [spyGuard1, spyGuard2, spyGuard3] 
            }
        ];
        
        navigate('spy', { routes: testRoutes });
        
        expect(spyGuard1.callCount).toBe(1);
        expect(spyGuard2.callCount).toBe(1);
        expect(spyGuard3.callCount).toBe(0); // Should stop after Allow
    });

    it('should stop at first Deny guard', () => {
        const spyGuard1 = new SpyGuard(GuardResult.Continue);
        const spyGuard2 = new SpyGuard(GuardResult.Deny);
        const spyGuard3 = new SpyGuard(GuardResult.Allow);
        
        const testRoutes: Route[] = [
            { 
                name: 'spy', 
                path: '/spy',
                guards: [spyGuard1, spyGuard2, spyGuard3] 
            }
        ];
        
        expect(() => navigate('spy', { routes: testRoutes }))
            .toThrow(RouteGuardError);
        
        expect(spyGuard1.callCount).toBe(1);
        expect(spyGuard2.callCount).toBe(1);
        expect(spyGuard3.callCount).toBe(0); // Should stop after Deny
    });

    it('should include guard name in error message', () => {
        expect(() => navigate('deny', { routes }))
            .toThrowError(RouteGuardError);
            
        expect(() => navigate('deny', { routes }))
            .toThrowError(/DenyGuard/);
    });

    it('should allow unguarded routes to pass', () => {
        let capturedEvent: NavigateRouteEvent | null = null;
        document.addEventListener('rlx.navigateRoute', (e) => {
            capturedEvent = e;
        });

        navigate('unguarded', { routes });
        
        expect(capturedEvent).not.toBeNull();
        expect(capturedEvent!.route.name).toBe('unguarded');
    });
});