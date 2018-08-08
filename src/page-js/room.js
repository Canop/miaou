miaou(function(locals, roomFinder){

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
		$('#img').val(room.img);
		$('#description').val(room.description);
		$('#private').val(room.private ? 'on' : 'off');
		$('#listed').val(room.listed ? 'on' : 'off');
		if (room.auth!=='own') $('#private').prop('disabled', true);
		$('#lang').val(room.lang || langs[0].key);
		$('#id').val(room.id);
		$("#tags").val(room.tags.join(" "));
		$('#cancel').click(function(){
			location = room.id
		});
	} else {
		$('#cancel').click(function(){
			location = 'rooms'
		});
	}
	$("#tags").editTagSet();
	if (error) {
		$('#err').text(error);
	}
	if (room && room.dialog) {
		$('#name,#private,#listed').prop('disabled', true);
	}
	$('form')[0].action = location;
	function checkName(input){
		$('#submit').prop('disabled', true);
		if (!input.value) {
			$('#err').text("Room name can't be empty");
		} else if (!input.validity.valid) {
			$('#err').text('Please type a ' + (input.value.length>50 ? 'shorter' : 'prettier') + ' name');
		} else {
			$('#err').text('');
			$('#submit').prop('disabled', false);
		}
	}
	$('#name').focus().keyup(function(){
		checkName(this);
	});
	checkName($("#name")[0]);


	function updatePreview(){
		$("#room-preview").empty().append(roomFinder.$square({
			name: $('#name').val(),
			img: $('#img').val(),
			description: $('#description').val(),
			tags: $("#tags").val().split(" ").filter(Boolean),
		}));
	}
	$('form').on("input blur focus", "input,textarea", updatePreview);


	$("#img").closest("tr").bubbleOn({
		side: "top-left",
		text: "Optional. Must be the HTTPS URL of an image."
	});

	updatePreview();

});
