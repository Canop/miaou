// the 'miaou' function initializes or extends module(s).
// This enables a kind of modularisation of miaou in different 
//  files without having
//  to bother about the initialization order and with less
//  boilerplate in each module code. It also allows to split
//  the initialization of a module in several files if needed
//  and makes the dependances clearer.
// The passed function will be called when the document
//  is ready, with argument values being the modules.
//

/*

Code A and code B here are equivalent

Code A :
--------

	$(function(){
		if (!miaou.A) miaou.A = {};
		var A = miaou.A,
			v = 1;
		A.a = function(i,j){
			return miaou.B.b1(i)-miaou.B.b2(j)-v++; // we can't alias miaou.B in B because it's defined after
		}
	});
	
	$(function(){
		if (!miaou.B) miaou.B = {};
		var B = miaou.B,
			A = miaou.A, // we can do this only because B is concatenated after A
			private = 3;
		B.b1 = function(i){
			return i*i;
		}
		B.b2 = function(i){
			return i>0 ? A.a(i, i-1) : i + private--;
		}
	});


Code B :
--------

	miaou(function(A, B){
		var v = 1;
		A.a = function(i,j){
			return B.b1(i)-B.b2(j)-v++;
		}
	});

	miaou(function(B, A){
		var private = 3;
		B.b1 = function(i){
			return i*i;
		}
		B.b2 = function(i){
			return i>0 ? A.a(i, i-1) : i + private--;
		}
	});


*/

// Note : this isn't compatible with mangling of function argument names
function miaou(f){
	$(function(){
		f.apply(null, f.toString().match(/\([^\)]+\)/)[0].match(/\w+/g).map(function(name){
			return miaou[name] = miaou[name] || {};
		}));
	});
}
