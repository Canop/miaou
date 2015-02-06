// the 'miaou' function initializes or extends module(s).
// This enables a kind of modularisation of miaou in different 
//  files without having to bother about the initialization order
//  and with less boilerplate in each module code. It also allows
//  to split the initialization of a module in several files if
//  needed and makes the dependances clearly appear.
// The passed function will be called when the document
//  is ready, with argument values being the modules.
//

/*

The two programs below are equivalent. See meld : http://i.imgur.com/NRQdwh0.png


Program 1 ( http://jsbin.com/tileka/2/edit ) :
----------------------------------------------

$(function(){
	if (!miaou.appl) miaou.appl = {};
	var appl = miaou.appl;
	appl.isWorldOK = function(a,b){
		var array = miaou.arr.repeat(a,b),
			result1 = miaou.maths.sums(array),
			result2 = miaou.maths.mult(a,b);
		console.log("result1:",result1, "result2:", result2);
		return result1===result2;
	}
	appl.main = function(){
		var a = miaou.maths.int(10),
			b = miaou.maths.int(10);
		$('<p>').text("Is it OK ? " + appl.isWorldOK(a,b)).appendTo('body');
	}
});
  

$(function(){
	if (!miaou.arr) miaou.arr = {};
	var  arr = miaou.arr;
	arr.repeat = function(n,v){
		return Array.apply(0,Array(n)).map(function(){ return v });
	}
	arr.reduce = function(array, f, v){
		for (var i=0; i<array.length; i++) v = f(v||0, array[i]);
		return v;
	}
});

$(function(){
	if (!miaou.maths) miaou.maths = {};
	var maths = miaou.maths;
    maths.int = function(m){
		return Math.random()*m|0;
    }
	maths.sums = function(array){
		return miaou.arr.reduce(array,function(a,b){ return a+b });
	}
	maths.mult = function(a,b){
		return a*b;
	}
});

$(function(){
  $(window).click(miaou.appl.main);
});


Program 2 ( http://jsbin.com/mubik/1/edit ) :
---------------------------------------------

miaou(function(appl, arr, maths){
	appl.isWorldOK = function(a,b){
		var array = arr.repeat(a,b),
			result1 = maths.sums(array),
			result2 = maths.mult(a,b);
		console.log("result1:",result1, "result2:", result2);
		return result1===result2;
	}
	appl.main = function(){
		var a = maths.int(10),
			b = maths.int(10);
		$('<p>').text("Is it OK ? " + appl.isWorldOK(a,b)).appendTo('body');
	}
});
  

miaou(function(arr){
	arr.repeat = function(n,v){
		return Array.apply(0,Array(n)).map(function(){ return v });
	}
	arr.reduce = function(array, f, v){
		for (var i=0; i<array.length; i++) v = f(v||0, array[i]);
		return v;
	}
});

miaou(function(maths, arr){
    maths.int = function(m){
		return Math.random()*m|0;
    }
	maths.sums = function(array){
		return arr.reduce(array,function(a,b){ return a+b });
	}
	maths.mult = function(a,b){
		return a*b;
	}
});

miaou(function(appl){
	$(window).click(appl.main);
});

*/


// Note : this isn't compatible with mangling of function argument names
function miaou(f){
	$(function(){
		f.apply(null, (f.toString().match(/\([^\)]*\)/)[0].match(/\w+/g)||[]).map(function(name){
			if (!miaou.hasOwnProperty(name)) miaou[name] = {};
			return miaou[name];
		}));
	});
}

(function(){
	
	// Initialization of locals (variables provided by the server for the page
	try {
		miaou.locals = JSON.parse($('#locals').html());
	} catch(e) {
		console.log("Error while loading locals");
	}
	
	// Discovery of the root URL
	var scripts = document.getElementsByTagName("script");
	for (var i=scripts.length; i--;) {
		if (!scripts[i].src) continue;
		var m = scripts[i].src.match(/(https?:\S+\/)static\/miaou(\.[a-z]+)?.js/);
		if (m) {
			miaou.root = m[1];
			break;
		}
	}
	
	// Sending errors to the server
	var nbsenterrors = 0;
	window.onerror = function(message, url, line, col, err){
		if (nbsenterrors++>3) {
			console.log("not sending error");
			return;
		}
		$.post("/error", {
			user:locals.me?locals.me.name:"?", // not always defined
			page:location.href,
			message:message,
			url:url, line:line, col:col,
			err:err
		});
	}
	
})();
