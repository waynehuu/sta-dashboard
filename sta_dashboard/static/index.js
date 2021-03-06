document.addEventListener('DOMContentLoaded', function () {

    var loader = document.getElementById('map-loader');
    
    document.querySelector('#query-filters').onsubmit = function () {

        loader.style.display = "block";

        // Initialize new request
        const query_request = new XMLHttpRequest();
        const ds_request = new XMLHttpRequest();
        const visualize_request = new XMLHttpRequest();

        // var endpoints_list = document.querySelectorAll('input[name="endpoint"]:checked');
        var properties_list = document.querySelectorAll('input[name="prop"]:checked');
        var start_date = document.querySelector('input[name="start-date"]');
        var end_date = document.querySelector('input[name="end-date"]');

        if (start_date.value.length > 0 && end_date.value.length > 0) {
            if (start_date.value >= end_date.value) {
                window.alert('Invalid date range: end date must be after start date');
                window.stop();
            }
        }

        query_request.open('POST', '/query_points');
        query_request.onload = function () {

            var data = JSON.parse(query_request.responseText);

            map.eachLayer(function (layer) {
                if (layer['options']['id'] != 'tileLayer') {
                    layer.remove()
                }
            });

            map.flyTo(data.viewLatlon, data.zoom_level);


            // Create a new MarkerClusterGroup
            var markers = L.markerClusterGroup({
                spiderfyOnMaxZoom: false,
                chunkedLoading: true,
                maxZoom: 12
            });

            // Add point markers
            var markerList = [];

            for (row of data.locations) {
                var marker = L.marker([row.latitude, row.longitude], {title: row.thingId}).on('click', markerOnClick);

                function markerOnClick(e) {
                    var thingId = e.target.options.title

                    var chartModal = document.getElementById('visualizationModal');
                    var span = document.getElementsByClassName("close")[0];
                    var canvasDiv = document.getElementById('canvasDiv');
                    canvasDiv.style.display = 'none';
                    var dsSelectorDiv = document.getElementById('datastreamsSelectorDiv');
                    dsSelectorDiv.innerHTML = '';


                    ds_request.open('POST', '/show_available_datastreams');

                    const dsDataStr = new FormData();
                    dsDataStr.append('thingId', JSON.stringify(thingId));
                    ds_request.send(dsDataStr);
                    ds_request.onload = function () {

                        var dsData = JSON.parse(ds_request.responseText);

                        for (i = 0; i < dsData.availableDatastreamsByProperty.length; i++) {
                            var dsName = dsData.availableDatastreamsByProperty[i];
                            var dsId = dsData.availableDatastreamsById[i];
                            var el = document.createElement('input');
                            var label = document.createElement('label');
                            el.type = 'checkbox';
                            el.name = 'datastream_available';
                            el.value = dsId;
                            dsSelectorDiv.appendChild(el);
                            dsSelectorDiv.appendChild(label);
                            label.appendChild(document.createTextNode(dsName));
                        }

                        submitButton = document.createElement('input')
                        submitButton.type = 'submit';
                        dsSelectorDiv.appendChild(submitButton);

                        submitButton.onclick = function () {

                            canvasDiv.innerHTML = '';
                            visualize_request.open('POST', '/visualize_observations');
                            // display visualization modal

                            // construct a form of data to send to server
                            const visualizeDataStr = new FormData();
                            var ds_list = document.querySelectorAll('input[name="datastream_available"]:checked');
                            var dsListValues = new Array();
                            for (var ds of ds_list.values()) {
                                dsListValues.push(ds.value);
                            }

                            visualizeDataStr.append('startDate', JSON.stringify(start_date.value));
                            visualizeDataStr.append('endDate', JSON.stringify(end_date.value));
                            visualizeDataStr.append('thingId', JSON.stringify(thingId));
                            visualizeDataStr.append('dsList', JSON.stringify(dsListValues));
                            visualize_request.send(visualizeDataStr);

                            // plot the data with chart.js
                            visualize_request.onload = function () {
                                var observations = JSON.parse(visualize_request.responseText);
                                var canvasEl = document.createElement('canvas');
                                canvasDiv.appendChild(canvasEl);
                                canvasEl.maintainAspectRatio = false;

                                var scatterChart = new Chart(canvasEl, {
                                    type: 'scatter',
                                    data: {
                                        datasets: observations['value'],
                                        options: {
                                            tooltips: {
                                                callbacks: {
                                                    title(datasets) {
                                                        var time = new Date(datasets[0].xLabel * 1000);
                                                        return (time.getMonth() + 1) + '/' + time.getDate() + ' ' + time.getHours();
                                                    }
                                                }
                                            },
                                            scales: {
                                                xAxes: [
                                                    {
                                                        type: 'linear',
                                                        position: 'bottom',
                                                        ticks: {
                                                            callback(value) {
                                                                var time = new Date(value * 1000);
                                                                return (time.getMonth() + 1) + '/' + time.getDate() + ' ' + time.getHours();
                                                            }
                                                        }
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                });
                                canvasDiv.style.display = 'block';
                            }
                        }
                    }

                    chartModal.style.display = 'block';
                    span.onclick = function () {
                        canvasDiv.innerHTML = '';
                        chartModal.style.display = "none";
                    }
                }
                markerList.push(marker);
            }

            markers.addLayers(markerList);
            map.addLayer(markers);

            const checckbox_title = `${markerList.length} locations found.`;
            document.querySelector('#checkbox-title').innerHTML = checckbox_title;
            loader.style.display = 'none';
            window.alert(checckbox_title);

        }

        var endpoints = [];
        var properties = [];
        for (property of properties_list) {
            [endpoint, prop] = property.value.split(',');
            properties.push(prop);
            endpoints.push(endpoint);
        }

        const dataStr = new FormData();
        dataStr.append('endpoints', JSON.stringify(endpoints));
        dataStr.append('properties', JSON.stringify(properties));
        dataStr.append('startDate', JSON.stringify(start_date.value));
        dataStr.append('endDate', JSON.stringify(end_date.value));

        // Send the endpoints list to server
        query_request.send(dataStr);
        return false;

    }
})
