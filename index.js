(function() {
	function isArray(a) {
		return "[object Array]" == ({}).toString.call(Object(a));
	}

	function isRexExp(a) {
		return "[object RegExp]" == ({}).toString.call(Object(a));
	}

	/** @callback overrideRequest
	 * @param {Object} req 原有请求数据
	 * @property {string} req.url 原有url，字符串，不包含search参数, 支持通配符*
	 * @property {string} req.method 原有method
	 * @property {Object} req.headers 原有headers，键值对象，不会传入null
	 * @property {Object} req.search 原有search参数，键值对象，不会传入null
	 * @property {boolean} req.withCredentials 原有的withCredentials
	 * @property {string|null} req.user 原有的open传入的user,默认为null
	 * @property {string|password} req.password 原有的open传入的password, 默认为null
	 * @property {*} req.data 原有的data
	 * @property {boolean} req.async 原有的async
	 * @property {string} req.mimeType 原有的mimeType, overrideMimeType设置的mimeType
	 * @property {number} req.timeout 原有的超时时间
	 * @returns {req} 修改后的请求数据，在传入的req上修改后返回
	 * 
	 */

	/** 
	 * 
	 * @callback overrideResponse
	 * @param {Object} res 原有的res
	 * @property {Object} res.headers 原有headers，键值对象，不会传入null
	 * @property {number} res.status  
	 * @property {string} res.statusText  
	 * @property {string} res.responseType  
	 * @property {string} res.responseURL  
	 * @property {string} res.response  
	 * @property {string} res.responseText  
	 * @property {string} res.responseXML  
	 * @returns {*} 修改后的res，在传入的res上修改后返回
	 * 
	 */ 
	
	/**
	 * 劫持XMLHttpRequest
	 * @global 
	 * @param {...Object} rule 劫持规则
	 * @property {string|RegExp|string[]} rule.url 原请求地址，若传入的参数未携带search参数，则匹配时也会忽略search参数；正则匹配时不会忽略search参数; 若域名和location域名相同，会忽略域名
	 * @property {overrideRequest=} rule.before 发送前的处理
	 * @property {overrideResponse=} rule.after 对返回值的处理, 默认情况下rule.after仅在readyState===4的时候调用，可通过rule.callAfterEveryState修改
	 * @property {boolean=} rule.callAfterEveryState 每次readystatechange变更时都调用rule.after去修改res
	 * 
	 * @example
	 * hijackAjax({
	 * 	url: '/article/list',
	 * 	before: req => {
	 * 		req.url = 'recommend/list';
	 * 		return req;
	 * 	},
	 * 	after: res => {
	 * 		let data = JSON.parse(res.responseText);
	 * 		data.name = 'test';
	 * 		res.responseText = JSON.stringify(data);
	 * 		return res;
	 * 	}
	 * })
	 * 
	 * @todo 暂时不支持监听open之前的addEventListener
	 * 可以劫持XMLHttpRequest.prototype.addEventListener，在open之前先放入队列，open之后根据url判断是否需要重新劫持
	 * 需要劫持的listener全部removeEventListener，通过队列的回调去触发
	 * 
	 */
	window.hijackAjax = function(rule) {
		overrideRules.unshift.apply(overrideRules, arguments)
	}
	
	var overrideRules = [];
	// var originAddEventListener = XMLHttpRequest.prototype.addEventListener;
	// var originRemoveEventListener = XMLHttpRequest.prototype.removeEventListener;

	function hasOrigin(url, origin) {
		url = url.split('#').shift().split('?').shift()
		return url === origin || url.indexOf(origin + '/') === 0
	}

	function matchRule(originUrl, ruleUrl) {
		if (isArray(ruleUrl)) {
			for (var i = 0; i < ruleUrl.length; i++) {
				if (matchRule(originUrl, ruleUrl)) {
					return true;
				}
			}
		} else if (isRexExp(ruleUrl)) {
			return ruleUrl.test(originUrl);
		} else if (typeof ruleUrl === 'string') {
			originUrl = ruleUrl.indexOf('?') > -1 ? originUrl : originUrl.split('?').shift();
			if (hasOrigin(ruleUrl, location.origin)) {
				ruleUrl = ruleUrl.substr(location.origin.length)
			}
			if (ruleUrl.lastIndexOf('*') === ruleUrl.length - 1) {
				return originUrl.indexOf(ruleUrl.slice(0, -1)) > -1;
			}
			return originUrl === ruleUrl;
		}

		return false
	}

	function parseUrl(url) {
		if (hasOrigin(url, location.origin)) {
				url = url.substr(location.origin.length)
		}
		return url.split('?').shift()
	}

	function parseSearch(url) {
		var ret = {};
		var querystring = url.split('#').shift().split('?').slice(1).join('?');
		var arr = querystring.split('&');
		for (var i = 0; i < arr.length; i++) {
			var pair = arr[i].split('=');
			ret[decodeURIComponent(pair[0])] = decodeURIComponent(pair.slice(1).join('='));
		}

		return ret;
	}

	function stringifySearch(search) {
		var querystring = '';
		if (search) {
			var arr = [];
			for (var i in search) {
				if (search.hasOwnProperty(i)) {
					arr.push([encodeURIComponent(i), encodeURIComponent(search[i])].join('='))
				}
			}
			querystring = arr.join('&');
		}

		return querystring
	}

	function parseHeaders(str) {
		var ret = {};
		var arr = str.split('\r\n');
		for (var i = 0; i < arr.length; i++) {
			var pair = arr[i].split(': ');
			ret[decodeURIComponent(pair[0])] = decodeURIComponent(pair.slice(1).join(': '));
		}

		return ret;
	}

	function stringifyHeader(headers) {
		var arr = [];
		for (var i in headers) {
			if (headers.hasOwnProperty(i)) {
				arr.push([i, hijacker.res.headers[i]].join(': '))
			}
		}
		return arr.join('\r\n');
	}

	function hijack(originXhr, rule, openArgs) {
		var hijacker = originXhr.__hijack_xhr___ = {
			req: {
				method: openArgs[0].toUpperCase(),
				url: parseUrl(url),
				search: parseSearch(url),
				async: openArgs[2] === false ? false : true,
				user: openArgs[3],
				password: openArgs[4],
				withCredentials: originXhr.withCredentials,
				headers: {},
				mimeType: null,
				timeout: originXhr.timeout,
				data: null
			},
			res: {
				status: originXhr.status,
				statusText: originXhr.statusText,
				headers: {},
				responseType: originXhr.responseType,
				responseURL: originXhr.responseURL,
				response: originXhr.response,
				responseText: originXhr.responseText,
				responseXML: originXhr.responseXML
			},
			xhr: originXhr,
			descriptors: Object.getOwnPropertyDescriptors(Object.getPrototypeOf(originXhr)),
			event: {
				addEventListener: originXhr.addEventListener.bind(originXhr),
				removeEventListener: originXhr.removeEventListener.bind(originXhr),
				onreadystatechange: originXhr.onreadystatechange,
				onload: originXhr.onload,
				onloadend: originXhr.onloadend,
				listeners: []
			}
		};
		
		Object.defineProperties(originXhr, {
			withCredentials: {
				get: function() {
					return hijacker.req.withCredentials;
				},
				set: function(value) {
					hijacker.req.withCredentials = value;
				}
			},
			timeout: {
				get: function() {
					return hijacker.req.timeout;
				},
				set: function(value) {
					hijacker.req.timeout = value;
				}
			},
			setRequestHeader: {
				value: function(header, value) {
					hijacker.req.headers[header] = value;
				}
			},
			overrideMimeType: {
				value: function(value) {
					hijacker.req.mimeType = value
				}
			},
			send: {
				value: function(data) {
					var req = hijacker.req;
					req.data = data;
					
					if (rule.before) {
						req = hijacker.req = rule.before(req);
					}

					if (req.withCredentials) {
						hijacker.descriptors.withCredentials.set.call(originXhr, req.withCredentials);
					}

					if (req.timeout) {
						hijacker.descriptors.timeout.set.call(originXhr, req.timeout);
					}

					if (req.mimeType) {
						hijacker.descriptors.overrideMimeType.value.call(originXhr, req.mimeType);
					}
					
					hijacker.descriptors.open.value.call(originXhr, req.method, req.url + '?' + stringifySearch(req.search), req.async, req.user, req.password);
					
					for (var header in req.headers) {
						if (req.headers.hasOwnProperty(i)) {
							hijacker.descriptors.setRequestHeader.value.call(originXhr, header, req.headers[header]);
						}
					}

					// 状态变更时，挂载response数据
					function onreadystatechange(args, callback) {
						var res = hijacker.res;
						if (this.readyState === this.HEADERS_RECEIVED) {
							var headerString = hijacker.descriptors.getAllResponseHeaders.value.call(this);
							res.headers = parseHeaders(headerString)
						}

						if (this.readyState === this.LOADING || this.readyState === this.DONE) {
							res.status = hijacker.descriptors.status.get.call(this);
							res.statusText = hijacker.descriptors.statusText.get.call(this);
							res.responseType = hijacker.descriptors.responseType.get.call(this);
							res.response = hijacker.descriptors.response.get.call(this);
							res.responseText = hijacker.descriptors.responseText.get.call(this);
							res.responseXML = hijacker.descriptors.responseXML.get.call(this);
						}

						if (rule.after && (rule.callAfterEveryState || this.readyState === this.DONE)) {
							res = hijacker.res = rule.after(res);
						}

						Object.defineProperties(this, {
							'status': {
								value: res.status
							},
							'statusText': {
								value: res.statusText
							},
							'responseType': {
								value: res.responseType
							},
							'response': {
								value: res.response
							},
							'responseText': {
								value: res.responseText
							},
							'responseXML': {
								value: res.responseXML
							}
						})

						if (typeof callback === 'function') {
							callback.apply(this, args);
						}
					}

					// 触发hijacker.event.listeners
					function triggerListeners(type, args) {
						var listeners = hijacker.event.listeners;
						for (var i = 0; i < listeners.length; i++) {
							var item = listeners[i];
							if (item[0] === type) {
								item[1].apply(this, args);
							}
						}

						if (type === 'load' || type === 'readystatechange' || type === 'loadend') {
						} else {
							hijacker.event.removeEventListener.apply(this, arguments);
						}
					}

					hijacker.descriptors.onreadystatechange.set.call(originXhr, function() {
						onreadystatechange.call(this, arguments, hijacker.event.onreadystatechange);
					});
					hijacker.descriptors.onload.set.call(originXhr, function() {
						onreadystatechange.call(this, arguments, hijacker.event.onload);
					});
					hijacker.descriptors.onloadend.set.call(originXhr, function() {
						onreadystatechange.call(this, arguments, hijacker.event.onloadend);
					})
					hijacker.addEventListener('readystatechange', function() {
						onreadystatechange.call(this, arguments, triggerListeners.call(this, 'readystatechange', arguments));
					})
					hijacker.addEventListener('load', function() {
						onreadystatechange.call(this, arguments, triggerListeners.call(this, 'load', arguments));
					})
					hijacker.addEventListener('loadend', function() {
						onreadystatechange.call(this, arguments, triggerListeners.call(this, 'loadend', arguments));
					})

					hijacker.descriptors.send.value.call(originXhr, req.data);
				}
			},
			onreadystatechange: {
				get: function() {
					return hijacker.event.onreadystatechange
				},
				set: function() {
					hijacker.event.onreadystatechange = value
				}
			},
			onload: {
				get: function() {
					return hijacker.event.onload
				},
				set: function(value) {
					hijacker.event.onload = value
				}
			},
			onloadend: {
				get: function() {
					return hijacker.event.onloadend
				},
				set: function(value) {
					hijacker.event.onloadend = value
				}
			},
			// open之前的addEventListener是无法劫持的
			addEventListener: {
				value: function(type, listener) {
					if (type === 'load' || type === 'readystatechange' || type === 'loadend') {
						hijacker.event.listeners.push([type, listener])
					} else {
						hijacker.event.addEventListener.apply(this, arguments);
					}
				}
			},
			removeEventListener: {
				value: function(type, listener) {
					if (type === 'load' || type === 'readystatechange' || type === 'loadend') {
						for (var i = 0; i < hijacker.event.listeners.length; i++) {
							var item = hijacker.event.listeners[i];
							if (item[0] === type && item[1] === listener) {
								hijacker.event.listeners.splice(i--, 1);
							}
						}
					} else {
						hijacker.event.removeEventListener.apply(this, arguments);
					}
				}
			},
			getAllResponseHeaders: {
				value: function() {
					return stringifyHeader(hijacker.res.headers);
				}
			},
			getResponseHeader: {
				value: function(header) {
					return hijacker.res.headers[header];
				}
			}
		})
	}

	XMLHttpRequest.prototype.open = function(method, url, async) {
		var hit = false
		for (var i = 0; i < overrideRules.length; i++) {
			var rule = overrideRules[i];
			if (matchRule(url, rule.url)) {
				hit = true
				break
			}
		}
		
		if (hit) {
			var __hijack_xhr___ = this.__hijack_xhr___;
			hijack(this, arguments);
		}

	}
})()

