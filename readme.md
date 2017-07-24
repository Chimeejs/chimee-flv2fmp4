![icon](http://gao111.top/icon/giticon.png)

```
npm install chimee-flv2fmp4 -S

var cpu= require("chimee-flv2fmp4")

new cpu();
```
-----------------
# Doc
## function
* setflv(arraybuffer) 参数,arraybuffer数组,返回值是该数值用到的位置
* onInitSegment(fun)  参数,回调function, mp4初始化数据调用该方法,类型为uint8array
* onMediaSegment(fun) 参数,回调function,mp4后续数据包会回调方法,类型为uint8array
* onMediaInfo(fun)    参数,回调function,MP4获取metadata后会回调该方法,类型为object
* seekCallBack(fun)   参数,回调function,跳转触发后,可进行跳转时回调
* seek(time)          参数,时间,单位是秒,进行跳转
* on(type,function)   参数,事件名,回调function,事件监听

## event
* error 核心出现问题时会向外派发这个事件
	