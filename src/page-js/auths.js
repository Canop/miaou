$(function(){
	$(document.body).addClass(
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
	);
});
miaou(function(gui, locals, prof, time){
	var room = locals.room;
		
	$('.date').text(function(_,t){
		return Date.now()/1000-t<15*60 ? "just now" : time.formatRelativeTime(t);
	});
	$('input,select').change(function(){ this.name = this.getAttribute('_name') });
	if (!(room.auth==='own'||room.auth==='admin')) {
		$('input,select').prop('disabled', true);
	} else {
		$('input, select').change(function(){ $('#submit_bar input').prop('disabled', false) })
		$('input[type=reset]').click(function(){ $('#submit_bar input').prop('disabled', true) });
	}
	$('#auths-page')
	.on('mouseenter', '.user', prof.show).on('mouseleave', '.profile', prof.hide);
	$('#backToRoom').click(function(){ location = room.path; return false });
	$('input[type=radio]').click(function(){
		var $row = $(this).closest('tr').nextAll('.denyMessageTr').first();
		if (this.value=='deny') $row.show().find('input').focus();
		else $row.hide();
	})
	$('td.rendered').each(function(){
		var h = this.innerHTML;
		if (h) this.innerHTML = miaou.fmt.mdTextToHtml(h);
		else $(this).closest('tr').hide()
	})
});
