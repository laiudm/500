// prettified and reverse engineered from https://unpkg.com/preact@10.4.0/hooks/dist/hooks.umd.js
// original source is at https://unpkg.com/browse/preact@10.4.0/hooks/src/index.js
!function(n, t) {
    "object" == typeof exports && "undefined" != typeof module	// work out the appropriate way to export this module
		? t(exports, require("preact")) 						// exports exists, so use it
		: "function" == typeof define && define.amd 			
			? define(["exports", "preact"], t) 					// define exists, so use it
			: t(n.preactHooks = {}, n.preact)					// none of these exist, so save directly to the caller's object, which = this.
}(this, function(n, t) {			// called with n = this.preactHooks, t = this.preact
    var u, 
		r, 							// currentComponent
		i, 
		o = [], 					// afterPaintEffects 
		f = t.options.__r, 			// oldBeforeRender 
		e = t.options.diffed, 		// oldAfterDiff 
		c = t.options.__c, 			// oldCommit 
		a = t.options.unmount;		// oldBeforeUnmount 
		
	t.options.__r = function(n) {	// 21: options._render = vnode => {
        f && f(n),
        u = 0,
        (r = n.__c).__H && (r.__H.__h.forEach(m),
        r.__H.__h.forEach(h),
        r.__H.__h = [])
    };
	t.options.diffed = function(n) {	// 33: options.diffed = vnode => {
        e && e(n);
        var u = n.__c;
        if (u) {
            var r = u.__H;
            r && r.__h.length && (1 !== o.push(u) && i === t.options.requestAnimationFrame || ((i = t.options.requestAnimationFrame) || function(n) {
                var t, u = function() {
                    clearTimeout(r),
                    cancelAnimationFrame(t),
                    setTimeout(n)
                }, r = setTimeout(u, 100);
                "undefined" != typeof window && (t = requestAnimationFrame(u))
            }
            )(l))
        }
    };
	
    t.options.__c = function(n, u) {	// 47: options._commit = (vnode, commitQueue) => {
        u.some(function(n) {
            try {
                n.__h.forEach(m),
                n.__h = n.__h.filter(function(n) {
                    return !n.__ || h(n)
                })
            } catch (r) {
                u.some(function(n) {
                    n.__h && (n.__h = [])
                }),
                u = [],
                t.options.__e(r, n.__v)
            }
        }),
        c && c(n, u)
    };

    t.options.unmount = function(n) {	// 66: options.unmount = vnode => {
        a && a(n);
        var u = n.__c;
        if (u) {
            var r = u.__H;
            if (r)
                try {
                    r.__.forEach(function(n) {
                        return n.t && n.t()
                    })
                } catch (n) {
                    t.options.__e(n, u.__v)
                }
        }
    };
	

	/**
	* Get a hook's state from the currentComponent
	* @param {number} index The index of the hook to get
	* @returns {import('./internal').HookState}
	*/
	
	//dcm: only ever called with currentIndex++, so just allocates the next sequential slot (and allocates the struct in the first place if needed)
	//dcm: the struct is attached to the preact component (_not_ the DOM node), so slots are truly created on the first time around. After that, the pre-allocated slots are
	//dcm: just returned. 		
    function v(n) {					// 87: function getHookState(index) {
        t.options.__h && t.options.__h(r);		//if (options._hook) options._hook(currentComponent);
		// Largely inspired by:
		// * https://github.com/michael-klein/funcy.js/blob/f6be73468e6ec46b0ff5aa3cc4c9baf72a29025a/src/hooks/core_hooks.mjs
		// * https://github.com/michael-klein/funcy.js/blob/650beaa58c43c33a74820a3c98b3c7079cf2e333/src/renderer.mjs
		// Other implementations to look at:
		// * https://codesandbox.io/s/mnox05qp8		
        const hooks = 
			r.__H || 							// currentComponent.__hooks ||
			(r.__H = {  __: [], __h: [] });		// (currentComponent.__hooks = { _list: [], _pendingEffects: [] });
				
        if ( n >= hooks.__.length) {
			hooks.__.push({});
		}
        return hooks.__[n];
    }
	getHookState = v;
	
	n.useState = p;					// 107: export function useState(initialState) { See above too
    function p(n) {					// 107: export function useState(initialState) { // export is at line 143 below
        return d(T, n)
    }
	
	n.useReducer = d;				// 117: export function useReducer(reducer, initialState, init) {
    function d(n, t, i) {			// 117: export function useReducer(reducer, initialState, init) { // again export is below
        var o = getHookState(u++);
        return o.__c || (o.__c = r,
        o.__ = [i ? i(t) : T(void 0, t), function(t) {
            var u = n(o.__[0], t);
            o.__[0] !== u && (o.__[0] = u,
            o.__c.setState({}))
        }
        ]),
        o.__
    }
	
	n.useEffect = function(n, t) {	// 143: export function useEffect(callback, args) {
        var i = v(u++);
        x(i.__H, t) && (i.__ = n,
        i.__H = t,
        r.__H.__h.push(i))
    }
	
	n.useLayoutEffect = y;			// 158: export function useLayoutEffect(callback, args) {
    function y(n, t) {				// 158: export function useLayoutEffect(callback, args) {
        var i = v(u++);
        x(i.__H, t) && (i.__ = n,
        i.__H = t,
        r.__h.push(i))
    }
	
	// create some persistent storage that exists between calls.
	// the value stored in xx.current is written to directly via preact's ref: attribute
    n.useRef = function(initialValue) {				// 169: export function useRef(initialValue) {
		return useMemo( () => ({current: initialValue}), []);
    };
	
	/**
	* @param {object} ref
	* @param {() => object} createHandle
	* @param {any[]} args
	*/
    n.useImperativeHandle = function(n, t, u) {		// 178: export function useImperativeHandle(ref, createHandle, args) {
        y(function() {
            "function" == typeof n ? n(t()) : n && (n.current = t())
        }, null == u ? u : u.concat(n))
    };
	
	/**
	* @param {() => any} factory
	* @param {any[]} args
	*/
	//dcm: Doc: With the useMemo hook we can memoize the results of an expensive computation and only recalculate it when one of the dependencies changes.
	//dcm: In this case the expensive computation is done by factory().
    n.useMemo = useMemo;							// 192: export function useMemo(factory, args) {	
    function useMemo(factory, args) {				// 192: useMemo
        let state = getHookState(u++);				//dcm: allocate/get 'my' hook slot.
        if ( argsChanged(state.__H, args)) {
			state.__H = args;
			state.__h = factory;					//dcm: don't know why this is saved, it's never accessed elsewhere
			return (state.__ = factory())
		}
		return state.__;
    }

	/**
	* @param {() => void} callback
	* @param {any[]} args
	*/	
    n.useCallback = function(n, t) {	// 208: export function useCallback(callback, args) {
        return useMemo(function() {
            return n
        }, t)
    };
	
	/**
	* @param {import('./internal').PreactContext} context
	*/
    n.useContext = function(n) {	// 215: export function useContext(context) {
        var t = r.context[n.__c];
        if (!t)
            return n.__;
        var i = v(u++);
        return null == i.__ && (i.__ = !0,
        t.sub(r)),
        t.props.value
    };

    n.useDebugValue = function(n, u) {	// 231: export function useDebugValue(value, formatter) {
        t.options.useDebugValue && t.options.useDebugValue(u ? u(n) : n)
    };

    n.useErrorBoundary = function(n) {	// 237: export function useErrorBoundary(cb) {
        var t = v(u++)
          , i = p();
        return t.__ = n,
        r.componentDidCatch || (r.componentDidCatch = function(n) {
            t.__ && t.__(n),
            i[1](n)
        }
        ),
        [i[0], function() {
            i[1](void 0)
        }
        ]
    }
	
    function l() {					// 258: function flushAfterPaintEffects() {
        o.some(function(n) {
            if (n.__P)
                try {
                    n.__H.__h.forEach(m),
                    n.__H.__h.forEach(h),
                    n.__H.__h = []
                } catch (u) {
                    return n.__H.__h = [],
                    t.options.__e(u, n.__v),
                    !0
                }
        }),
        o = []
    }
    function m(n) {					// 316: function invokeCleanup(hook) {
        n.t && n.t()
    }
    function h(n) {					// 324: function invokeEffect(hook) {
        var t = n.__();
        "function" == typeof t && (n.t = t)
    }
    function x(n, t) {				// 333: function argsChanged(oldArgs, newArgs) {
        return !n || t.some(function(t, u) {
            return t !== n[u]
        })
    }
	let argsChanged = x;
    function T(n, t) {				// 337: function invokeOrReturn(arg, f) {
        return "function" == typeof t ? t(n) : t
    }

});
//\\# sourceMappingURL=hooks.umd.js.map
