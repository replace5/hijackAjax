# ajax请求劫持
> 用于三方代码或者chrome extension在无法修改原代码逻辑的情况下劫持页面原有ajax请求，对发送内容和响应内容进行修改。


<a name="hijackAjax"></a>

## hijackAjax(...rule)
劫持XMLHttpRequest

**Kind**: global function

| Param | Type | Description |
| --- | --- | --- |
| ...rule | <code>Object</code> | 劫持规则 |

**Properties**

| Name | Type | Description |
| --- | --- | --- |
| rule.url | <code>string</code> \| <code>RegExp</code> \| <code>Array.&lt;string&gt;</code> | 原请求地址，若传入的参数未携带search参数，则匹配时也会忽略search参数；正则匹配时不会忽略search参数; 若域名和location域名相同，会忽略域名；字符串时支持结尾统配符* |
| [rule.before] | [<code>overrideRequest</code>](#overrideRequest) | 发送前的处理 |
| [rule.after] | [<code>overrideResponse</code>](#overrideResponse) | 对返回值的处理, 默认情况下rule.after仅在readyState===4的时候调用，可通过rule.callAfterEveryState修改 |
| [rule.callAfterEveryState] | <code>boolean</code> | 每次readystatechange变更时都调用rule.after去修改res |

**Example**
```js
hijackAjax({
	url: '/article/list',
	before: req => {
		req.url = 'recommend/list';
		return req;
	},
	after: res => {
		let data = JSON.parse(res.responseText);
		data.name = 'test';
		res.responseText = JSON.stringify(data);
		return res;
	}
})
```

## Typedefs

<dl>
<dt><a href="#overrideRequest">overrideRequest</a> ⇒ <code>req</code></dt>
<dd></dd>
<dt><a href="#overrideResponse">overrideResponse</a> ⇒ <code>*</code></dt>
<dd></dd>
</dl>

<a name="overrideRequest"></a>

## overrideRequest ⇒ <code>req</code>
**Kind**: global typedef
**Returns**: <code>req</code> - 修改后的请求数据，在传入的req上修改后返回

| Param | Type | Description |
| --- | --- | --- |
| req | <code>Object</code> | 原有请求数据 |

**Properties**

| Name | Type | Description |
| --- | --- | --- |
| req.url | <code>string</code> | 原有url，字符串，不包含search参数 |
| req.method | <code>string</code> | 原有method |
| req.headers | <code>Object</code> | 原有headers，键值对象，不会传入null |
| req.search | <code>Object</code> | 原有search参数，键值对象，不会传入null |
| req.withCredentials | <code>boolean</code> | 原有的withCredentials |
| req.user | <code>string</code> \| <code>null</code> | 原有的open传入的user,默认为null |
| req.password | <code>string</code> \| <code>password</code> | 原有的open传入的password, 默认为null |
| req.data | <code>\*</code> | 原有的data |
| req.async | <code>boolean</code> | 原有的async |
| req.mimeType | <code>string</code> | 原有的mimeType, overrideMimeType设置的mimeType |
| req.timeout | <code>number</code> | 原有的超时时间 |

<a name="overrideResponse"></a>

## overrideResponse ⇒ <code>\*</code>
**Kind**: global typedef
**Returns**: <code>\*</code> - 修改后的res，在传入的res上修改后返回

| Param | Type | Description |
| --- | --- | --- |
| res | <code>Object</code> | 原有的res |

**Properties**

| Name | Type | Description |
| --- | --- | --- |
| res.headers | <code>Object</code> | 原有headers，键值对象，永远不会传入null |
| res.status | <code>number</code> | 原有status |
| res.statusText | <code>string</code> | 原有statusText |
| res.responseType | <code>string</code> | 原有responseType |
| res.responseURL | <code>string</code> | 原有responseURL |
| res.response | <code>string</code> | 原有response |
| res.responseText | <code>string</code> | 原有responseText |
| res.responseXML | <code>string</code> |  原有responseXML|
