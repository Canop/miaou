
miaou(function(locals){

	console.log('in pad');
	
	var showroomstimer;
	function showRoomsPanel(){
		$('#room-and-rooms').addClass('open').removeClass('closed');
		showroomstimer = setTimeout(function(){
			$('#rooms').fadeIn("fast");
		}, 500);
	}
	function hideRoomsPanel(){
		clearTimeout(showroomstimer);
		$('#rooms').hide();
		$('#room-and-rooms').addClass('closed').removeClass('open');		
	}
	
	$('#room-and-rooms').on('mouseenter', showRoomsPanel);
	$('#stripe').on('mouseleave', hideRoomsPanel);

});
