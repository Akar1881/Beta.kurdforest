const mongoose = require('mongoose');

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  releaseYear: { type: Number },
  genre: { type: String },
  posterUrl: { type: String },
});

const Movie = mongoose.model('Movie', movieSchema);

module.exports = Movie;