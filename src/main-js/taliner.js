// https://github.com/Canop/taliner.js
$.fn.taliner = function(){

	let	$d = $('<div>').appendTo('body'),
		$s1 = $('<span>').text('a').appendTo($d),
		$s2 = $('<span>').appendTo($d),
		lh =  $s1.height();

	$d.css({
		width: this.width(),
		height: this.height(),
		font: this.css('font'),
		fontFamily: this.css('fontFamily'), // for FF/linux
		fontSize: this.css('fontSize'),
		whiteSpace : 'pre-wrap',
		wordWrap : 'break-word',
		overflowY: 'auto',
		position: 'fixed',
		bottom: 0,
		left: 0,
		padding: 0,
		zIndex: 666
	});

	let	input = this[0],
		se = input.selectionEnd,
		v = input.value,
		res = {};

	lh = $s1.height();
	$s1.text(v);
	res.linesNumber = $s1.height()/lh|0;

	$s1.text(v.slice(0, se));
	$s2.text(v.slice(se));
	res.caretOnFirstLine = input.selectionEnd===0 || ($s1.height()<=lh && $s1.offset().top===$s2.offset().top);
	res.caretOnLastLine = $s2.height()<=lh;

	$d.remove();
	return res;
}
