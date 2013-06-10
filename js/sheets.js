
var sheets = angular.module('sheets', ['filters','services','editable','infinite-scroll','ui.bootstrap']);

sheets.config(['$httpProvider', function($httpProvider) {
	 // $httpProvider.defaults.useXDomain = true;
    delete $httpProvider.defaults.headers.common["X-Requested-With"];
    // delete $httpProvider.defaults.headers.post["X-CSRFToken"];
}]);


function DialogController($scope, dialog, triple){
  $scope.triple = triple;
  $scope.triple.oldO = triple.o.value;
  console.log(triple);
  
  $scope.close = function(){
    dialog.close();
  };
  $scope.edit = function(){
  	if($scope.triple.o.value == $scope.triple.oldO)
    	dialog.close();
    else
    	dialog.close($scope.triple);
  };
}

function sheetCtrl($scope, $compile, $dialog, SparqlService, PrefixService, SparqlUpdateService) {
	$scope.endpoint = "http://localhost:3030/ik/sparql";
	$scope.endpointUpdate = "http://localhost:3030/ik/update";
	$scope.limit = 100;
	$scope.offset = 0;
	$scope.querying = false;
	$scope.busy = true;
	$scope.settingsVisible = false;
	$scope.all = false;
	//$scope.triples = [];
	//$scope.properties = [];
	$scope.oProperties = {};
	$scope.columns = [];
	$scope.rows = [];
	$scope.subjects = undefined;
	$scope.classes = {};
	$scope.metaClasses = [];
	$scope.selectedClass = undefined;
	$scope.orderBy = undefined;
	$scope.propertiesReady = false;
	$scope.settingProperties = [];
	$scope.objects = {};
	$scope.titles = {};
	
	$scope.properties = undefined;
	
	$scope.opts = {
    backdrop: true,
    keyboard: true,
    backdropClick: true,
    templateUrl:  'tpl/dialog.html',
    controller: 'DialogController',
    
  };
 
 $scope.setSettings = function() {
 	$scope.settingsVisible = !$scope.settingsVisible;
 }
 
  $scope.openDialog = function(triple){
  	$scope.opts.resolve = {triple: function() {return triple}}
    var d = $dialog.dialog($scope.opts);
    d.open().then(function(triple){
      if(triple)
      {
      	updateTriple("default",triple.s.value,triple.p.value,triple.oldO,triple.o.value);
      }
    });
  };
	
	$scope.loadMore = function() {
		if ($scope.busy) return;
		$scope.busy = true;
		if(!$scope.all) {
			$scope.offset+=$scope.limit;
			console.log("Loading triples "+$scope.offset);
			getTriples(tripleQry("default",$scope.limit,$scope.offset,$scope.orderBy,$scope.selectedClass));
		}
	}
	
   $scope.getMoreTriples = function() {
    	$scope.offset+=$scope.limit;
    }
    
    $scope.edit = function(triple) {
    	console.log(triple);
    	var newValue = window.prompt("Edit this",triple.o.value);
    	if(newValue!=null) {
    		console.log(newValue);
    		updateTriple("default",triple.s.value,triple.p.value,triple.o.value,newValue);
    		triple.o.value=newValue;
    	}
    }
	
	function initialize() {
		console.log("Initalizing ...");
		$scope.propertiesReady = false;
		//$scope.triples.length = 0;
		//$scope.properties.length = 0;
		$scope.columns.length = 0;
		$scope.rows.length = 0;
		$scope.subjects = {};
		$scope.oProperties = {};
		$scope.all = false;
		$scope.busy = true;
		$scope.offset = 0;
		$scope.objects = {};
	}
	
	$scope.followLink = function(triple) {
		console.log("da triple")
		console.log(triple);
		initialize();
		$scope.selectedClass = "All";
		getTriples(subjectTriplesQry("default",triple.o.value));
	}

	$scope.selectSheet = function(a) {
		
		console.log("Select sheet "+a);
    	if(a=="All") $scope.selectedClass = undefined;
     	else $scope.selectedClass = a;
    }
    
    $scope.addNew = function(a) {
    	console.log(a);
    }
    /*
    $scope.$watch('oProperties',function(newP,oldP) {
    	if(prop!==undefined && !_.isEmpty(prop)) {
    		// _.size(
    		console.log("test");
	    	$scope.properties = _.map(oProperties, function(vValue, vKey) {
	        return { key:vKey, value:vValue };
	    }); }
    });*/
	
	$scope.$watch('endpoint',function(e) {
		getClasses("default");	
	});
	
	$scope.$watch('selectedClass',function(e) {
		initialize();
		getTriples(tripleQry("default",$scope.limit,$scope.offset,$scope.orderBy,$scope.selectedClass));
		//getProperties("default",e);
	});
	
	/*
	$scope.$watch('propertiesReady',function(ready) {
		if(ready) {
			console.log("Getting triples ...");
			getTriples("default",$scope.limit,$scope.offset,$scope.orderBy,$scope.selectedClass);
		}
	});
	*/
	
    function updateQry(graph,s,p,o,newO) {
    	if(newO.type==="uri")
	    	return (graph=="default" ? "" : ("WITH <"+graph+"> ")) +
			"DELETE { <"+s+"> <"+p+"> <"+o+"> } "+
			"INSERT { <"+s+"> <"+p+"> <"+newO+">  } "+
			"WHERE{ <"+s+"> <"+p+"> <"+o+"> } "
		else 
			return (graph=="default" ? "" : ("WITH <"+graph+"> ")) +
			"DELETE { <"+s+"> <"+p+"> '"+o+"' } "+
			"INSERT { <"+s+"> <"+p+"> '"+newO+"'  } "+
			"WHERE{ <"+s+"> <"+p+"> '"+o+"' } "
    }
    
   function updateTriple(graph,s,p,o,newO) {
        SparqlUpdateService.query($scope.endpointUpdate,updateQry(graph,s,p,o,newO)).success(function(data) {
        	console.log("modified?")
        	console.log(data);
        });   	
   }
   
   
	function titleQry(graph,s) {
    		return "SELECT ?ol ?label WHERE {"+
    		(graph != "default" ? " GRAPH <"+graph+"> { " : "")+
    		"OPTIONAL { <"+s+"> ?ol ?label FILTER(STRENDS(STR(?ol),'name') || STRENDS(STR(?ol),'label') || STRENDS(STR(?ol),'title')) }"+
    		(graph != "default" ? " } " : "")+
    		"}"
    }

    function classQry(graph) {
    		return "SELECT DISTINCT ?c WHERE {"+
    		(graph != "default" ? " GRAPH <"+graph+"> { " : "")+
    		" ?s a ?c "+
    		(graph != "default" ? " } " : "")+
    		"} GROUP BY ?c"
    }
    
    function proQry(graph,ctype) { 
            	return "SELECT ?p (count(?p) as ?c) WHERE {"+
            	(graph != "default" ? (" GRAPH <"+graph+"> { "):"")+
            	"?s ?p ?o . "+
            	(ctype !==undefined ? "?s a <"+ctype+"> . ":"")+
            	(graph != "default" ? (" } "):"")+
            	"} GROUP BY ?p" 
     }
     
    function subjectTriplesQry(graph,s) {
    		return "SELECT ?s ?p ?o WHERE {"+
    		(graph != "default" ? " GRAPH <"+graph+"> { " : "")+
    		"VALUES (?s) { (<"+s+">) } "+
    		"?s ?p ?o . "+
    		(graph != "default" ? " } " : "")+
    		"}"
    }
   
    function tripleQry(graph,limit,offset,order,ctype) {
    		return "SELECT ?s ?p ?o WHERE {"+
    		(graph != "default" ? " GRAPH <"+graph+"> { " : "")+ 	
    		(ctype !==undefined ? "?s a <"+ctype+"> . ":"")+	
    		" ?s ?p ?o . "+
    		(order!==undefined ? "OPTIONAL { ?s <"+order+"> ?o . }" : "")+
    		(graph != "default" ? " } " : "")+
    		(order!==undefined ? "} ORDER BY ?s ?o" : "} ORDER BY ?s")+
    		" LIMIT "+limit+" OFFSET "+offset
    }
    
    function getTitles(graph,s,id) {
    	$scope.querying = true;
        SparqlService.query($scope.endpoint,titleQry(graph,s))
         .success(function(data) {
         	$scope.querying = false;
             if(data.results.bindings.length>=1) {
             	var bestLabel = undefined;
             	var priority = 4;
                 data = data.results.bindings;
	                 for(item in data) {
	                    // FIXME: Some priority here ?!
	                    if(data[item].label!==undefined) {
	                    	if(priority>1 && data[item].ol.value.indexOf("name") !== -1) {
	                    		priority = 1;
	                    		bestLabel = data[item].label.value;
	                    	}
	                   		if(priority>2 && data[item].ol.value.indexOf("label") !== -1) {
	                    		priority = 2;
	                    		bestLabel = data[item].label.value;
	                    	}
	                 		if(priority>3 && data[item].ol.value.indexOf("title") !== -1) {
	                    		priority = 3;
	                    		bestLabel = data[item].label.value;
	                    	}
	                    }
	                    	
                 }
                if(bestLabel!==undefined)
	        		$scope.titles[id!==undefined ? id : s] = bestLabel;
             }
         });  
    }
    
    $scope.title = function(s) {
    	if($scope.titles[s]!==undefined) return $scope.titles[s];
    	else return s;
    }
    
    
    function getClasses(graph) {
    	$scope.querying = true;
        SparqlService.query($scope.endpoint,classQry(graph))
         .success(function(data) {
         	$scope.querying = false;
             if(data.results.bindings.length>=1) {
                 data = data.results.bindings;
                 for(item in data) {
                 	resolved = PrefixService.resolve(data[item].c.value);
                 	
                 	if(resolved.namespace=="http://www.w3.org/2002/07/owl#" || resolved.namespace=="http://www.w3.org/2000/01/rdf-schema#")	
                    	$scope.metaClasses.push(resolved);
                    else
                        $scope.classes[resolved.id] = resolved;
                    	// $scope.classes.push(resolved);
                 }
             }
         });  
    	
    	
    }
    

        	
   function getTriples(qry) {
   	//FIXME: What if the ctype has changed before the success ??
    $scope.querying = true;
        SparqlService.query($scope.endpoint,qry)
         .success(function(data) {
         	$scope.querying = false;
             if(data.results.bindings.length>=1) {
                 data = data.results.bindings;
                 console.log("Pushing items")
                 for(item in data) {
                 	   	

                 	if($scope.oProperties[data[item].p.value]===undefined) {
                 		
                 	if(data[item].p.value=="http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
                 		//FIXME: Store all properties to classes object !?!?
                 	}
                 		
                 		resolved = PrefixService.resolve(data[item].p.value);
                 		resolved.objects = {};
                 		$scope.oProperties[data[item].p.value] = resolved;
                 		 getTitles("default",resolved.id,resolved.localName);	
                 	}
                 	
                      	
                   // $scope.triples.push(data[item]);
                   
                    // Push all subjects to subjects-object
                    if($scope.subjects[data[item].s.value]===undefined) {
                		$scope.subjects[data[item].s.value] = data[item].s;//[data[item]];
                		$scope.subjects[data[item].s.value].type = [];
                	} else {
                		//$scope.subjects[data[item].s.value].push(data[item]);
                	}
                	

                	if(data[item].o.type==="uri") {
                		if($scope.objects[data[item].o.value]===undefined) {
                			$scope.objects[data[item].o.value] = data[item].o;
                		}
                		else data[item].o = $scope.objects[data[item].o.value];
                	} 
                	

                	if($scope.oProperties[data[item].p.value].objects[data[item].s.value] === undefined) {
                		
                		                	
                	if(data[item].p.value=="http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
                		$scope.subjects[data[item].s.value].type.push($scope.classes[data[item].o.value]);
                		//$scope.subjects[data[item].s.value].type.push(data[item].o.value);
                	}
                		
                		if(data[item].p.value=="http://xmlns.com/foaf/0.1/name") {
                			$scope.subjects[data[item].s.value].label = data[item].o.value;
                		} else if(data[item].p.value=="http://purl.org/dc/elements/1.1/title") {
                			$scope.subjects[data[item].s.value].label = data[item].o.value;
                		}
                		
                		$scope.oProperties[data[item].p.value].objects[data[item].s.value] = [data[item]]
                	} else {
                		$scope.oProperties[data[item].p.value].objects[data[item].s.value].push(data[item]);
                	}
                	
                 }
			
				 // Get titles for all of the objects
				 // FIXME: SLOW! What if title is always undefined !?!?
	             for(ae in $scope.objects) {
	             	if($scope.titles[$scope.objects[ae].value]===undefined)
	           	  	getTitles("default",$scope.objects[ae].value);	
	             }
             
             
             } else {
             	// Everything is already queried
             	$scope.all = true;
             }
             
             
             // FIXME: This is ugly hack and way too slow!!!
             // Better to resolve correct column when it is first queried 
             // OR use propertyOrder array !!!
             
            /* $scope.properties = _.map($scope.oProperties, function(vValue, vKey) {
	       		 return { key:vKey, value:vValue };
	    	});*/
	    	
             
             console.log("oProperties");
             console.log($scope.oProperties);
             console.log($scope.properties);
             console.log("subjects:")
             console.log($scope.subjects);
             $scope.busy = false;
         });  
    }

/*    
  function arrangeRows() {
   	console.log("Arranging rows");

	// For each subject   	
  	for(s in $scope.subjects) {
  	    // Loop all triples
  		var trow = $scope.subjects[s];
  		var newRow = [];
  		
  			for(p in $scope.properties) {
  				
  				// List of properties in use
  				var usedProperties = {};
  				usedProperties[$scope.properties[p].id] = {p:$scope.properties[p],cell:[]};
  				newRow.push(usedProperties[$scope.properties[p].id]);
  				
  				for(col in trow) {
  					if($scope.properties[p].id===trow[col].p.value) {
  						usedProperties[$scope.properties[p].id].cell.push(trow[col].o);
  					} 
  				}
  				
  			}	
  	  	$scope.rows.push(newRow);
  	  	
  	 }
  }
  */
   
  // No need to worry about the properties !?
  /*
  function getProperties(graph,ctype) {
  	console.log("Getting properties ...")
    $scope.querying = true;
        SparqlService.query($scope.endpoint,proQry(graph,ctype))
         .success(function(data) {
         	$scope.querying = false;
             if(data.results.bindings.length>=1) {
                 data = data.results.bindings;
                 for(item in data) {
                 	resolved = PrefixService.resolve(data[item].p.value);
                 	
                 	
                 	if(data[item].p.value=="http://www.w3.org/1999/02/22-rdf-syntax-ns#type") {
                 		//FIXME: Is this needed?
                 	}
                 	else if($scope.oProperties[data[item].p.value]===undefined) {
                 		resolved = PrefixService.resolve(data[item].p.value);
                 		resolved.objects = {};
                 		$scope.oProperties[data[item].p.value] = resolved;
                 	}
                 
                 	//if(data[item].p.value=="http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
                 	//	$scope.properties.unshift(resolved); 
                 	//else
                    //	$scope.properties.push(resolved);
                   
                 }
                 
                 $scope.propertiesReady = true;
             }
             
         });      
   }*/ 
    

       
function ValidUrl(str) {
  var pattern = new RegExp('^(https?:\\/\\/)?'+ // protocol
  '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // domain name
  '((\\d{1,3}\\.){3}\\d{1,3}))'+ // OR ip (v4) address
  '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // port and path
  '(\\?[;&a-z\\d%_.~+=-]*)?'+ // query string
  '(\\#[-a-z\\d_]*)?$','i'); // fragment locator
  if(!pattern.test(str)) {
    return false;
  } else {
    return true;
  }
}

}
