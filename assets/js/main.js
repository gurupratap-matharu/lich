import * as bootstrap from 'bootstrap'

(() => {
  'use strict'

  const L = window.L
  const bsOffcanvas = new bootstrap.Offcanvas('.offcanvas')
  const map = L.map('map').setView([-34.603851, -58.381775], 9)

  // Base layers
  const OpenStreetMap = L.tileLayer(
    'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    {
      maxZoom: 16,
      minZoom: 5,
      attribution:
        '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }
  )

  const EsriNatGeoWorldMap = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles &copy; Esri &mdash; National Geographic, Esri, DeLorme, NAVTEQ, UNEP-WCMC, USGS, NASA, ESA, METI, NRCAN, GEBCO, NOAA, iPC',
      maxZoom: 16,
      minZoom: 5
    }
  )

  const mapboxUrl =
    'https://api.mapbox.com/styles/v1/mapbox/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}'
  const mapboxToken =
    'pk.eyJ1IjoiZ21hdGhhcnUiLCJhIjoiY2xxYjBsdnl0MHUxZzJxa2ZyNGR1dTA2YiJ9.BFDNK87qTHcgcCkB6dJN9Q'

  const mapboxAttribution = '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a> <strong><a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a></strong>'

  // Default map
  const streets = L.tileLayer(mapboxUrl, {
    id: 'streets-v12',
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 16,
    minZoom: 5,
    accessToken: mapboxToken,
    attribution: mapboxAttribution
  }).addTo(map)

  const satelliteStreets = L.tileLayer(mapboxUrl, {
    id: 'satellite-streets-v12',
    tileSize: 512,
    zoomOffset: -1,
    maxZoom: 16,
    minZoom: 5,
    accessToken: mapboxToken,
    attribution: mapboxAttribution
  })

  const IGN = L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
    attribution: '<a href="http://leafletjs.com" title="A JS library for interactive maps">Leaflet</a> | <a href="http://www.ign.gob.ar/AreaServicios/Argenmap/IntroduccionV2" target="_blank">Instituto Geográfico Nacional</a> + <a href="http://www.osm.org/copyright" target="_blank">OpenStreetMap</a>',
    minZoom: 5,
    maxZoom: 16
  })

  const baseLayers = {
    Streets: streets,
    Satellite: satelliteStreets,
    'Open Street Map': OpenStreetMap,
    'Esri NatGeo WorldMap': EsriNatGeoWorldMap,
    IGN
  }

  L.control.layers(baseLayers).addTo(map)

  function polystyle (feature) {
    return { opacity: 0.5, color: 'black', weight: 1, fillOpacity: 0.5 }
  }

  // Read ba province boundary data
  fetch('data/provincia-ba.geojson')
    .then((response) => response.json())
    .then((boundary) => {
      // Prepend these coordinates to invert the polygon selection
      boundary.features[0].geometry.coordinates.unshift([
        [180, -90],
        [180, 90],
        [-180, 90],
        [-180, -90]
      ])

      L.geoJson(boundary, { style: polystyle }).addTo(map)
    })

  // Build html snippet for canvas body based on each feature
  function renderCanvasHTML (feature) {
    const template = document.querySelector('#canvasTemplate')
    const cbody = document.querySelector('.offcanvas-body')

    // Clone the template and insert it into the canvas
    const clone = template.content.cloneNode(true)

    const title = clone.querySelector('.card-title')
    const icons = clone.querySelector('#canvasIcons')
    const iconTemplate = icons.querySelector('img')
    const description = clone.querySelector('.card-text')
    const video = clone.querySelector('#canvasVideo')
    const gallery = clone.querySelector('.gallery')
    const imageTemplate = clone.querySelector('.galleryImage')
    const accordion = clone.querySelector('#accordionCanvas')
    const accordionItem = clone.querySelector('.accordion-item')

    icons.replaceChildren()
    gallery.replaceChildren()
    accordion.replaceChildren()

    title.textContent = feature.properties.Nombre
    description.textContent = feature.properties['Resumen del conflicto']

    const iconPaths = (feature.properties['Tipo de ícono 2'] || '')
      .split(',')
      .filter(e => e)
      .map(e => e.trim())

    iconPaths.forEach(name => {
      const path = `assets/icons/icono-${name}.svg`
      const node = iconTemplate.cloneNode(true)
      node.src = path
      node.alt = name
      icons.appendChild(node)
    })

    const imagePaths = (feature.properties.Imagenes || '').trim().split('\n').filter(e => e)

    imagePaths.forEach((path) => {
      path = `media/${path}`
      const node = imageTemplate.cloneNode(true)
      node.href = path
      node.querySelector('img').src = path
      gallery.appendChild(node)
    })

    const videoUrl = feature.properties.Video || ''
    const renderVideo = videoUrl !== ''
      ? () => clone.querySelector('iframe').src = videoUrl // eslint-disable-line
      : () => clone.removeChild(video)

    renderVideo()

    const unwantedCols = [
      'Latitude',
      'Longitude',
      'Nombre',
      'Resumen del conflicto',
      'Tipo de Icono',
      'Tipo de ícono 2',
      'Video',
      'Imagenes'
    ]

    let entries = Object.keys(feature.properties)
    entries = entries.filter((e) => !unwantedCols.includes(e))

    entries.forEach((entry, i) => {
      const rawValue = feature.properties[entry]
      const value = entry.startsWith('Fuente') ? buildAnchorTags(rawValue) : rawValue
      const node = accordionItem.cloneNode(true)
      const button = node.querySelector('button')

      button.textContent = entry
      button.dataset.bsTarget = `#collapse${i}`
      button.setAttribute('aria-controls', `collapse${i}`)

      node.querySelector('.accordion-body').innerHTML = value
      node.querySelector('.accordion-collapse').id = `collapse${i}`

      accordion.appendChild(node)
    })

    cbody.replaceChildren(clone)
  }

  function buildAnchorTags (chunk) {
    // Helper method to build links with decorative text
    let tags = ''

    chunk.trim().split('\n').forEach(link => {
      const linkArray = link.split(',')
      tags += `<p><a href="${linkArray[1]}" target="_blank">${linkArray[0]}</a></p>`
    })
    return tags
  }

  // Bind popup for each feature
  function onEachFeature (feature, layer) {
    const name = feature.properties.Nombre || '---'
    layer.bindPopup(name)
  }

  // Render bootstrap offcanvas with feature details
  function renderCanvas (feature) {
    renderCanvasHTML(feature)
    bsOffcanvas.toggle()
  }

  // Generate a marker for each feature
  function pointToLayer (feature, latlng) {
    const iconName = feature.properties['Tipo de Icono'] || 'Agua'
    const iconUrl = `assets/icons/icono-${iconName}.svg`
    const icon = L.icon({ iconUrl, iconSize: [38, 95] })
    const marker = L.marker(latlng, { icon })
    marker.on('click', () => renderCanvas(feature))

    return marker
  }

  // Create an empty geojson layer
  const conflictsLayer = L.geoJSON([], {
    onEachFeature,
    pointToLayer
  }).addTo(map)

  // Read conflicts data and add it to the layer
  fetch('data/conflicts.geojson')
    .then((response) => response.json())
    .then((data) => {
      conflictsLayer.addData(data)
    })

  // Resize icons on zoom

  function resizeIcon (layer, iconSize) {
    const icon = layer.options.icon
    icon.options.iconSize = iconSize
    layer.setIcon(icon)
  }

  map.on('zoomend', function () {
    const currentZoom = map.getZoom()
    const iconSize = currentZoom < 7 ? [17, 50] : [38, 95]

    conflictsLayer.eachLayer((layer) => resizeIcon(layer, iconSize))
  })

  const welcomeModal = new bootstrap.Modal('#welcomeModal')
  welcomeModal.toggle()

  new L.Control.Search({
    layer: conflictsLayer,
    propertyName: 'Nombre',
    marker: false,
    initial: false,
    moveToLocation: function (latlng, title, map) {
      map.setView(latlng, 12)
    }
  }).addTo(map)
})()
