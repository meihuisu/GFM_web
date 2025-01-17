/**
    cxm_misc_util.c

a) export 'active' fault's geo out into an external file CFM7.0_geoJson.txt
b) import external geoJson.txt and create a groupLayer with optional name popup
c) import external latlon.csv with 'name' and create a group Layerof mulitple groups of points with different color 

**/

/***
--> needs gfm_regions.js
***/

var skipPopup=false;

function getSkipPopup() {
     return skipPopup;
}

function setSkipPopup(state) {
    skipPopup=state;
}

function getGFMRegionColorWithName(name) {
   var tb=GFM_tb['regions'];
   var cnt=tb.length;
   var i;
   for(i=0; i<cnt;i++) {
      var region=tb[i];
      if(region['name'] == name)
        return region['color'];
   }
   return undefined;
}

// should be a very small file and used for testing and so can ignore
// >>Synchronous XMLHttpRequest on the main thread is deprecated
// >>because of its detrimental effects to the end user's experience.
//     url=http://localhost/data/synapse/segments-dummy.csv
function ckCXMExist(url) {
  var http = new XMLHttpRequest();
  http.onreadystatechange = function () {
    if (this.readyState == 4) {
 // okay
    }
  }
  http.open("GET", url, false);
  http.send();
  if(http.status !== 404) {
    return http.responseText;
    } else {
      return null;
  }
}


// *** specifically for CFM_web ***
// create CFMXgeoJson.txt json file from cfm_trace_list.json
function dumpActiveCFMGeo() {
  var tracelist = [];
  var labellist = [];

  var csz=cfm_active_gid_list.length; // there is a search list result
  var tsz=cfm_trace_list.length;
  for(var i=0; i< tsz; i++) {
    var titem=cfm_trace_list[i];
    var gid=titem['gid'];
    var tracename=find_pretty_name_by_gid(gid);
    var atrace=titem['trace'];
    // either all, or has a active list
    if(!csz || in_active_gid_list(gid)) {
      labellist.push(tracename);
      tracelist.push(atrace);
    }
  }
  if(tracelist.length) {
    dumpActiveGeo("CFM_geoJson.txt", tracelist, labellist);
  }
}

// GFM is same as CRM --> surface layer
function dumpActiveGFMGeo() {
  var tracelist = [];
  var labellist = [];

  var tsz=gfm_trace_list.length;
  for(var i=0; i< tsz; i++) {
    var titem=gfm_trace_list[i];
    var gid=titem['gid'];
    var tracename=find_gfm_name_by_gid(gid);
    var atrace=titem['trace'];
    // either all, or has a active list
    labellist.push(tracename);
    tracelist.push(atrace);
  }

  if(tracelist.length) {
     dumpActiveGeo("GFM1.0_geoJson.txt", tracelist, labellist);
  }
}

function dumpActiveGeo(dumpname, trace_list, label_list) {

  var tsz=trace_list.length;
  var tlist=[];
  var i;
  for(var i=0; i< tsz; i++) {
    var atrace=trace_list[i];
    var tracename=label_list[i];
    var fsz=atrace.features.length;
    for(var j=0;j<fsz;j++) {
      atrace.features[j].properties.name=tracename;
    }
    tlist.push(atrace);
  }
  
  var dump={ 'trace_list': tlist }; 
  var dumpstring=JSON.stringify(dump);
  var dumpblob = new Blob([dumpstring], { type: "text/plain;charset=utf-8" });
  saveAs(dumpblob,dumpname);
}

// from a local file
function readLocalAndProcessActiveCFMGeo() {
  var url="data/CFM7.0_geoJson.txt";
  var blob=ckCXMExist(url);
  var jblob=JSON.parse(blob);

  var trace_list= jblob["trace_list"];
  var cnt=trace_list.length;
  var i;
  for(i=0;i<cnt;i++) { 
     var atrace=trace_list[i];

// change the color
     var tcnt=atrace.features.length;
     for(var j=0; j<tcnt; j++) {
       atrace.features[j].properties.style.color="black";
       atrace.features[j].properties.style.weight=1;
     }
// SPECIAL CASE
//   atrace.features[0].properties.style.color="red"; // the first one in all traces
     var name= atrace.features[0].properties.name;
//     window.console.log("adding trace.. ",name);
  }
 
  var group=makeGeoGroup(trace_list);
  return group;
}


// from an user selected client side file
function readAndProcessActiveGeo(urls) {
  var reader = new FileReader();

  reader.onload=function(event) {
    var evt = event.target.result; 
    var jblob= JSON.parse(reader.result);
    var trace_list= jblob["trace_list"];
    var cnt=trace_list.length;
    var i;
    for(i=0;i<cnt;i++) { 
       var atrace=trace_list[i];

       // change the color
       var tcnt=atrace.features.length;
       for(var j=0; j<tcnt; j++) {
         atrace.features[j].properties.style.color="orange";
       }
       var name= atrace.features[0].properties.name;
       window.console.log("adding trace.. ",name);
    }
    return makeGeoGroup(trace_list);
  };
  reader.readAsText(urls[0]);
}

function addGeoGroupToMap(traceList, mymap) {
   window.console.log("calling addGeoGroupToMap..");
   var group=makeGeoGroup(traceList);
   mymap.addLayer(group);
   return group;
}

function makeGeoGroup(traceList) {
   var cnt=traceList.length;
   window.console.log("number of importing traces ",cnt);
   var group = L.layerGroup();
   for(var i=0; i< cnt; i++) {
     var trace=traceList[i];
       var geoLayer=L.geoJSON(trace, {
         filter: function (feature, layer) {
           if (feature.properties) {
             var tmp=feature.properties.show_on_map != undefined ? !feature.properties.show_on_map : true;
             return tmp;
           }
           return false;
         },
         style: function(feature) {
           var tmp=feature.properties.style;
           if(feature.properties.style != undefined) {
             return feature.properties.style;
             } else {
               return {color: "#0000ff", "weight":2}
           }
         },
         onEachFeature: bindPopupEachFeatureName
     });
     group.addLayer(geoLayer);
   } 

   return group;
}


// binding the 'detail' fault content
function bindPopupEachFeatureName(feature, layer) {
    var popupContent="";
    layer.on({
        mouseover: function(e) {
          if(skipPopup == true)
            return;
          layer.setStyle({weight: 5});
          if (feature.properties != undefined) {
            popupContent = feature.properties.name;
          }
          layer.bindPopup(popupContent);
        },
        mouseout: function(e) {
          if(skipPopup == true)
            return;
          layer.setStyle({weight: 1});
        },
        click: function(e) {
          if (feature.properties != undefined) {
            popupContent = feature.properties.name;
          }
          layer.bindPopup(popupContent);
        },
    });
   
}

// from a local file
function readLocalAndProcessActiveGFMGeo() {
  var url="data/GFM1.0_geoJson.txt";
  var blob=ckCXMExist(url);
  var jblob=JSON.parse(blob);

  var trace_list= jblob["trace_list"];
  var cnt=trace_list.length;
  var i;
  for(i=0;i<cnt;i++) { 
     var atrace=trace_list[i];
     var tcnt=atrace.features.length;
     for(var j=0; j<tcnt; j++) {
// make it lighter
       atrace.features[j].properties.style.weight=0.3;
     }
     var name= atrace.features[0].properties.name;
     var p=atrace.features[0].properties;
//     window.console.log("adding gfm trace.. ",name);
  }

  var group=makeGeoGroup(trace_list);
  make_id2id_list(group);
  return group;
}

function loadGFMRegions() {
  getGFMAllTraces();
}

// from a local file
function readLocalAndProcessActiveCTMGeo() {
  var url="data/CTM_geoJson.txt";
  var blob=ckCXMExist(url);
  var jblob=JSON.parse(blob);

  var trace_list= jblob["trace_list"];
  var cnt=trace_list.length;
  var i;
  for(i=0;i<cnt;i++) {
     var atrace=trace_list[i];
     var tcnt=atrace.features.length;
     for(var j=0; j<tcnt; j++) {
// make it lighter
       atrace.features[j].properties.style.weight=0.3;
     }
     var name= atrace.features[0].properties.name;
     window.console.log("adding CTM trace.. ",name);
  }
  return makeGeoGroup(trace_list);
}

function loadCTMRegions() {
  getCTMAllTraces();
}


//domain,xcoord,ycoord
//Peninsular Range (E),-114.53244,29.43361
function readAndProcessActiveLatlon(urls) {
  var reader = new FileReader();

  reader.onload=function(event) {
    var evt = event.target.result; 
    var ffline = reader.result.split('\n');
    var cnt=ffline.length;
    var fdata=[];
    if(cnt == 0) {
      window.console.log("ERROR, can not process the upload file ");
      return;
    }
    var is_csv=0;
    if(ffline[0].includes(","))
      is_csv=1;

    // skip the first one
    for(i=1;i<cnt;i++) {
       var fline=ffline[i];

       if(is_csv) {
         $.csv.toArray(fline, {}, function(err, data) {
           var v=data;
           if( v != "" ) {
             fdata.push(v);
           }
         });
       } else {
// space separated format
           var v=fline.split(' ');
           if( v != "" ) {
             fdata.push(v);
           } 
       }   
    }  
    return makeRawLatlonGroup(fdata);

  };
  reader.readAsText(urls[0]);
}

function readLocalAndProcessActiveLatlon() {

  var url="data/CRM_polygons_points_with_corrected_Rift_names_Mar112019.csv";
  var blob=ckCXMExist(url);
  var ffline = blob.split('\n');
  var cnt=ffline.length;
  var fdata=[];
  if(cnt == 0) {
    window.console.log("ERROR, can not process the upload file ");
    return;
  }
  var is_csv=0;
  if(ffline[0].includes(","))
    is_csv=1;

  // skip the first one
  for(i=1;i<cnt;i++) {
     var fline=ffline[i];

     if(is_csv) {
       $.csv.toArray(fline, {}, function(err, data) {
         var v=data;
         if( v != "" ) {
           fdata.push(v);
         }
       });
     } else {
// space separated format
         var v=fline.split(' ');
         if( v != "" ) {
           fdata.push(v);
         } 
     }   
  }  
  return makeRawLatlonGroup(fdata);
}

function addRawLatlonGroupToMap(fdataList, mymap) {
   var group=makeRawLatlonGroup(fdataList);
   mymap.addLayer(group);
   return group;
}

function makeRawLatlonGroup(fdataList) {
   var cnt=fdataList.length;
   window.console.log("number of importing points ",cnt);
   var group = L.layerGroup();

   for(var i=0; i<cnt;i++) {
     var item=fdataList[i];

     var name=item[0];
     var lon=parseFloat(item[1]);
     var lat=parseFloat(item[2]);
    
     var color=getGFMRegionColorWithName(name);
     if(color == undefined) {
        window.console.log("BAD -- no color for ", name);
        continue;
     }

const myCustomColour = '#583470'

const markerHtmlStyles = `
  background-color: ${color};
  width: 0.2rem;
  height: 0.2rem;
  display: block;
  opacity: 80%;
  position: relative;
  border-radius: 50%;
  border: 1px solid ${color};
  transform: rotate(45deg)`

const newIcon = L.divIcon({
  className: '',
  html: `<span style="${markerHtmlStyles}" />`
})


     var small_point_options = { icon : newIcon};

     var bounds = [lat,lon ];
     var marker = L.marker(bounds, small_point_options);

     var icon = marker.options.icon;
     icon.options.iconSize = [5, 5];
     marker.setIcon(icon);

     group.addLayer(marker);

   } 
   return group;
}


