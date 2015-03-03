miaou(function(locals){

	$(document.body).addClass(
		/Android|webOS|iPhone|iPad|iPod|BlackBerry|Mini/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
	);
	var	langs = locals.langs,
		room = locals.room,
		error=locals.error;
	for (var key in langs) {
		var lang = langs[key];
		$('#lang').append($('<option>').attr('value', key).text(lang.name));
	}
	if (room) {
		$('.dialog-title').text('Room Edition');
		$('#name').val(room.name);
		$('#description').val(room.description);
		$('#private').val(room.private ? 'on' : 'off');
		$('#listed').val(room.listed ? 'on' : 'off');
		if (room.auth!=='own') $('#private').prop('disabled', true);
		$('#lang').val(room.lang || langs[0].key);
		$('#id').val(room.id);
		$('#cancel').click(function(){ location = room.id });
	} else {
		$('#cancel').click(function(){ location = 'rooms' });			
	}
	if (error) {
		$('#err').text(error);
	}
	$('form')[0].action = location;
	$('#name').focus().keyup(function(){
		if (!this.validity.valid){
			$('#err').text('Please type a ' + (this.value.length>50 ? 'shorter' : 'prettier') + ' name');
			$('#submit').prop('disabled', true);
		} else {
			$('#err').text('');
			$('#submit').prop('disabled', false);
		}
	});
	function format(){
		$('#roomdescription').html(miaou.fmt.mdToHtml($('#description').val()));
	}
	$('#description').keyup(format);
	format();

});
