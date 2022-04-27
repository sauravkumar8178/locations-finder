let map, datasource, client, popup, searchInput, resultsPanel, searchInputLength, centerMapOnResults;

//The minimum number of characters needed in the search input before a search is performed.
let minSearchInputLength = 3;

//The number of ms between key strokes to wait before performing a search.
let keyStrokeDelay = 150;

function GetMap() {
    //Initialize a map instance.
    map = new atlas.Map('myMap', {
        center: [77.2090, 28.6139], zoom: 14, view: 'Auto',

        //Add authentication details for connecting to Azure Maps.
        authOptions: {
            /*            //Use Azure Active Directory authentication.
                        authType: 'anonymous',
                        clientId: '04ec075f-3827-4aed-9975-d56301a2d663', //Your Azure Active Directory client id for accessing your Azure Maps account.
                        getToken: function (resolve, reject, map) {
                            //URL to your authentication service that retrieves an Azure Active Directory Token.
                            let tokenServiceUrl = "https://azuremapscodesamples.azurewebsites.net/Common/TokenService.ashx";

                            fetch(tokenServiceUrl).then(r => r.text()).then(token => resolve(token));
                        }*/

            //Alternatively, use an Azure Maps key. Get an Azure Maps key at https://azure.com/maps. NOTE: The primary key should be used as the key.
            authType: 'subscriptionKey', subscriptionKey: 'C5eKkYADkaOJ0mybkpV0Vv7AHEOYETocZCVCfk74mIE'
        }
    });

    //Store a reference to the Search Info Panel.
    resultsPanel = document.getElementById("results-panel");

    //Add key up event to the search box.
    searchInput = document.getElementById("search-input");
    searchInput.addEventListener("keyup", searchInputKeyup);

    //Create a popup which we can reuse for each result.
    popup = new atlas.Popup();

    //Wait until the map resources are ready.
    map.events.add('ready', function () {

        //Add the zoom control to the map.
        map.controls.add(new atlas.control.ZoomControl(), {
            position: 'top-right'
        });

        //Create a data source and add it to the map.
        datasource = new atlas.source.DataSource();
        map.sources.add(datasource);

        //Add a layer for rendering the results.
        var searchLayer = new atlas.layer.SymbolLayer(datasource, null, {
            iconOptions: {
                image: 'pin-round-darkblue', anchor: 'center', allowOverlap: true
            }
        });
        map.layers.add(searchLayer);

        //Add a click event to the search layer and show a popup when a result is clicked.
        map.events.add("click", searchLayer, function (e) {
            //Make sure the event occurred on a shape feature.
            if (e.shapes && e.shapes.length > 0) {
                showPopup(e.shapes[0]);
            }
        });
    });
}

function searchInputKeyup(e) {
    centerMapOnResults = false;
    if (searchInput.value.length >= minSearchInputLength) {
        if (e.keyCode === 13) {
            centerMapOnResults = true;
        }
        //Wait 100ms and see if the input length is unchanged before performing a search.
        //This will reduce the number of queries being made on each character typed.
        setTimeout(function () {
            if (searchInputLength === searchInput.value.length) {
                search();
            }
        }, keyStrokeDelay);
    } else {
        resultsPanel.innerHTML = '';
    }
    searchInputLength = searchInput.value.length;
}

function search() {
    //Remove any previous results from the map.
    datasource.clear();
    popup.close();
    resultsPanel.innerHTML = '';

    //Use MapControlCredential to share authentication between a map control and the service module.
    let pipeline = atlas.service.MapsURL.newPipeline(new atlas.service.MapControlCredential(map));

    //Construct the SearchURL object
    let searchURL = new atlas.service.SearchURL(pipeline);

    let query = document.getElementById("search-input").value;
    searchURL.searchPOI(atlas.service.Aborter.timeout(10000), query, {
        lon: map.getCamera().center[0], lat: map.getCamera().center[1], maxFuzzyLevel: 4, view: 'Auto'
    }).then((results) => {

        //Extract GeoJSON feature collection from the response and add it to the datasource
        let data = results.geojson.getFeatures();
        datasource.add(data);

        if (centerMapOnResults) {
            map.setCamera({
                bounds: data.bbox
            });
        }
        console.log(data);
        //Create the HTML for the results list.
        let html = [];
        for (let i = 0; i < data.features.length; i++) {
            let r = data.features[i];
            html.push('<li onclick="itemClicked(\'', r.id, '\')" onmouseover="itemHovered(\'', r.id, '\')">')
            html.push('<div class="title">');
            if (r.properties.poi && r.properties.poi.name) {
                html.push(r.properties.poi.name);
            } else {
                html.push(r.properties.address.freeformAddress);
            }
            html.push('</div><div class="info">', r.properties.type, ': ', r.properties.address.freeformAddress, '</div>');
            if (r.properties.poi) {
                if (r.properties.phone) {
                    html.push('<div class="info">phone: ', r.properties.poi.phone, '</div>');
                }
                if (r.properties.poi.url) {
                    html.push('<div class="info"><a href="http://', r.properties.poi.url, '">http://', r.properties.poi.url, '</a></div>');
                }
            }
            html.push('</li>');
            resultsPanel.innerHTML = html.join('');
        }

    });
}

function itemHovered(id) {
    //Show a popup when hovering an item in the result list.
    let shape = datasource.getShapeById(id);
    showPopup(shape);
}

function itemClicked(id) {
    //Center the map over the clicked item from the result list.
    let shape = datasource.getShapeById(id);
    map.setCamera({
        center: shape.getCoordinates(), zoom: 17
    });
}

function showPopup(shape) {
    let properties = shape.getProperties();
    //Create the HTML content of the POI to show in the popup.
    let html = ['<div class="poi-box">'];
    //Add a title section for the popup.
    html.push('<div class="poi-title-box"><b>');

    if (properties.poi && properties.poi.name) {
        html.push(properties.poi.name);
    } else {
        html.push(properties.address.freeformAddress);
    }
    html.push('</b></div>');
    //Create a container for the body of the content of the popup.
    html.push('<div class="poi-content-box">');
    html.push('<div class="info location">', properties.address.freeformAddress, '</div>');
    if (properties.poi) {
        if (properties.poi.phone) {
            html.push('<div class="info phone">', properties.phone, '</div>');
        }
        if (properties.poi.url) {
            html.push('<div><a class="info website" href="http://', properties.poi.url, '">http://', properties.poi.url, '</a></div>');
        }
    }
    html.push('</div></div>');
    popup.setOptions({
        position: shape.getCoordinates(), content: html.join('')
    });
    popup.open(map);
}
