$(function(){
	$('h2+div, h2+p, h3+div, h3+p').hide();
	$('h2, h3').click(function(){
		$(this).toggleClass('open').next('div, p').toggle();
	}).each(function(){
		var hash = '#' + $(this).text().replace(/\W/g, '_');
		if (hash===location.hash) {
			$(this).parents().prev('h2').add(this).click();
		}
		$(this).clone().appendTo('#summary').click(function(){
			location.hash = hash;
			location.reload();
		});
	});
	$('#summary h1').click(function(){
		location.hash = '';
		location.reload();
	});
});
