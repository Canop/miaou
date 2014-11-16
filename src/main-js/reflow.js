// WebKit sometimes forget to reflow an element when the size of some child changes
// See http://stackoverflow.com/questions/3485365/how-can-i-force-webkit-to-redraw-repaint-to-propagate-style-changes
// This function forces the reflow. One can only hope I'll be able to remove it some day...
$.fn.reflow = function(){
	var e = this[0]; // this hack function doesn't iterate because it should not be called on a collection
	e.style.display = 'none';
	e.offsetHeight;
	e.style.display = '';
}
