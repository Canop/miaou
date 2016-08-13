miaou(function(tableControls){

	const DAT_KEY = "table-controller";

	function diff(a, b){
		if (a > b) return 1;
		if (a < b) return -1;
		return 0;
	}

	function numDiff(a, b){
		if (a != a) {
			return b!=b ? 0 : -1;
		}
		if (b != b) return 1;
		return diff(a, b);
	}

	const sortFunctions = {
		"number-up": function(a, b){
			var	index = this,
				na = toNumber(a.cells[index].textContent),
				nb = toNumber(b.cells[index].textContent);
			return numDiff(na, nb);
		},
		"number-down": function(a, b){
			var	index = this,
				na = toNumber(a.cells[index].textContent),
				nb = toNumber(b.cells[index].textContent);
			return numDiff(nb, na);
		},
		"name-up": function(a, b){
			var	index = this,
				na = a.cells[index].textContent.toLowerCase(),
				nb = b.cells[index].textContent.toLowerCase();
			return diff(na, nb);
		},
		"name-down": function(a, b){
			var	index = this,
				na = a.cells[index].textContent.toLowerCase(),
				nb = b.cells[index].textContent.toLowerCase();
			return diff(nb, na);
		}
	};

	function toNumber(s){
		var m = s.replace(/\s+/g, '').match(/\d+(\.\d+)?/);
		return m ? +m[0] : NaN;
	}

	function ColumnController(tblCon, index){
		this.index = index;
		this.$th = tblCon.$head.find("th").eq(index);
		this.name = this.$th.text();
		this.tblCon = tblCon;
		this.nbAlphaCells = 0;
		this.nbNumCells = 0;
		var n = tblCon.$rows.length;
		for (var i=n; i-->1;) {
			var txt = tblCon.$rows.eq(i).find("td").eq(index).text();
			if (!txt) continue;
			txt = txt.trim();
			if (/\d+/.test(txt)) this.nbNumCells++;
			this.nbAlphaCells++;
		}
		this.isNumSortable = this.nbNumCells >= n*.5
			|| (this.nbNumCells >= .9*this.nbAlphaCells && this.nbNumCells>2);
		this.isAlphaSortable = this.nbAlphaCells >= n*.6 && this.nbNumCells < .9*n;
	}
		
	ColumnController.prototype.show = function(){
		var cc = this;
		var $c = $("<div>").addClass("column-controller").appendTo(this.$th);
		function addIcon(key){
			var $i = $("<span>").addClass("icon-sort-"+key)
			.click(cc.sort.bind(cc, key))
			.appendTo($c);
			if (cc.tblCon.lastApplied == key + cc.index) {
				$i.addClass("active");
			}
		}
		if (this.isNumSortable) {
			addIcon("number-up");
			addIcon("number-down");
		}
		if (this.isAlphaSortable) {
			addIcon("name-up");
			addIcon("name-down");
		}
	};


	ColumnController.prototype.sort = function(key){
		this.tblCon.sort(key, this.index);
		$(".column-controller span").each(function(){
			this.classList.toggle("active", this.classList.contains("icon-sort-"+key));
		});
	}

	function TableController($table){
		this.$table = $table;
		this.$rows = $table.find("tr");
		this.$head = this.$rows.eq(0);
		this.$rows = this.$rows.slice(1);
		this.cols = [];
		this.lastApplied = null; // syntax: <key><col index>
		for (var i = this.$head.find("th").length; i--; ) {
			this.cols[i] = new ColumnController(this, i);
		}
	}

	TableController.prototype.sort = function(key, index){
		this.lastApplied = key+index;
		var rows = this.$table.find("tr").slice(1).remove().get();
		rows.sort(sortFunctions[key].bind(index));
		this.$table.append(rows);
	}

	TableController.prototype.showOnColumn = function($th){
		this.cols[$th.index()].show();
	}

	function isTableControllable($table){
		var $rows = $table.find("tr");
		return	$table.length
			&& /^tbl\d+$/.test($table.attr("id"))
			&& $rows.length > 4
			&& $rows.eq(0).find("th").length>1;
	}

	$("#messages").on("mouseenter", ".content th", function(){
		var	$th = $(this),
			$table = $th.closest("table"),
			con = $table.dat(DAT_KEY);
		if ($th.closest("table").index()) {
			return;
		}
		if (!con) {
			if (!isTableControllable($table)) {
				console.log("table not controllable");
				return;
			}
			$table.dat(DAT_KEY, con = new TableController($table))
			.addClass("controlled");
		}
		con.showOnColumn($th);
	}).on("mouseleave", "th", function(){
		$(".column-controller").remove();
	});

});
