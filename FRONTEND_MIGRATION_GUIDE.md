# 📋 Руководство по обновлению фронтенда для работы с жанрами

## ✅ Что уже готово

1. **Backend API** - запущен на http://localhost:8000
2. **API клиент для жанров** - создан `frontend/src/api/genres.js`
3. **Миграция БД** - выполнена, жанры в базе данных

---

## 🔧 Что нужно изменить

### 1. Обновить компонент `FilmCard.js`

**Было:**
```jsx
// Отображение одного жанра как строка
<Typography variant="body2" color="text.secondary">
  {film.genre}
</Typography>
```

**Стало:**
```jsx
// Отображение массива жанров как чипы
<Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
  {film.genres && film.genres.map((genre) => (
    <Chip
      key={genre.id}
      label={genre.name}
      size="small"
      color="primary"
      variant="outlined"
    />
  ))}
</Box>
```

**Не забудьте импортировать:**
```jsx
import { Chip, Box } from '@mui/material';
```

---

### 2. Обновить страницу `Home.js` (фильтрация по жанрам)

**Было:**
```jsx
// Фильтрация по строковому полю genre
const filteredFilms = films.filter(film =>
  selectedGenre ? film.genre?.includes(selectedGenre) : true
);
```

**Стало:**
```jsx
import { useState, useEffect } from 'react';
import { getGenres } from '../api/genres';

// В компоненте
const [genres, setGenres] = useState([]);
const [selectedGenreId, setSelectedGenreId] = useState(null);

// Загрузка жанров при монтировании компонента
useEffect(() => {
  const fetchGenres = async () => {
    try {
      const genresData = await getGenres();
      setGenres(genresData);
    } catch (error) {
      console.error('Failed to fetch genres:', error);
    }
  };
  fetchGenres();
}, []);

// Фильтрация фильмов по ID жанра
const filteredFilms = films.filter(film => {
  if (!selectedGenreId) return true;
  return film.genres?.some(g => g.id === selectedGenreId);
});

// В JSX - выпадающее меню с жанрами
<FormControl sx={{ minWidth: 200 }}>
  <InputLabel>Жанр</InputLabel>
  <Select
    value={selectedGenreId || ''}
    onChange={(e) => setSelectedGenreId(e.target.value || null)}
    label="Жанр"
  >
    <MenuItem value="">Все жанры</MenuItem>
    {genres.map((genre) => (
      <MenuItem key={genre.id} value={genre.id}>
        {genre.name}
      </MenuItem>
    ))}
  </Select>
</FormControl>
```

---

### 3. Обновить страницу `FilmDetail.js`

**Было:**
```jsx
<Typography variant="body1" gutterBottom>
  <strong>Жанр:</strong> {film.genre}
</Typography>
```

**Стало:**
```jsx
<Box sx={{ mb: 2 }}>
  <Typography variant="body1" component="span" sx={{ fontWeight: 'bold', mr: 1 }}>
    Жанры:
  </Typography>
  {film.genres && film.genres.map((genre, index) => (
    <Chip
      key={genre.id}
      label={genre.name}
      size="small"
      color="primary"
      variant="outlined"
      sx={{ mr: 0.5 }}
    />
  ))}
</Box>
```

---

### 4. Обновить админ-панель `FilmsManage.js`

Это самое важное изменение для создания/редактирования фильмов!

**Добавить импорты:**
```jsx
import { useState, useEffect } from 'react';
import { getGenres } from '../../api/genres';
import {
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Box,
  OutlinedInput
} from '@mui/material';
```

**Добавить состояние для жанров:**
```jsx
const [genres, setGenres] = useState([]);
const [selectedGenreIds, setSelectedGenreIds] = useState([]);

// Загрузка жанров
useEffect(() => {
  const fetchGenres = async () => {
    try {
      const genresData = await getGenres();
      setGenres(genresData);
    } catch (error) {
      console.error('Failed to fetch genres:', error);
    }
  };
  fetchGenres();
}, []);
```

**При открытии формы редактирования:**
```jsx
const handleEditFilm = (film) => {
  setFormData({
    title: film.title,
    // ... другие поля
  });

  // Установить выбранные жанры
  setSelectedGenreIds(film.genres?.map(g => g.id) || []);

  setEditingFilm(film);
  setOpenDialog(true);
};
```

**При создании нового фильма:**
```jsx
const handleAddFilm = () => {
  setFormData({
    title: '',
    // ... другие поля
  });
  setSelectedGenreIds([]); // Очистить выбранные жанры
  setEditingFilm(null);
  setOpenDialog(true);
};
```

**Добавить в форму мультиселект для жанров:**
```jsx
<FormControl fullWidth margin="normal">
  <InputLabel>Жанры</InputLabel>
  <Select
    multiple
    value={selectedGenreIds}
    onChange={(e) => setSelectedGenreIds(e.target.value)}
    input={<OutlinedInput label="Жанры" />}
    renderValue={(selected) => (
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {selected.map((genreId) => {
          const genre = genres.find(g => g.id === genreId);
          return (
            <Chip
              key={genreId}
              label={genre?.name || genreId}
              size="small"
            />
          );
        })}
      </Box>
    )}
  >
    {genres.map((genre) => (
      <MenuItem key={genre.id} value={genre.id}>
        {genre.name}
      </MenuItem>
    ))}
  </Select>
</FormControl>
```

**При отправке формы:**
```jsx
const handleSubmit = async () => {
  try {
    const filmData = {
      ...formData,
      genre_ids: selectedGenreIds, // ВАЖНО: отправляем массив ID жанров
    };

    if (editingFilm) {
      await filmsAPI.updateFilm(editingFilm.id, filmData);
    } else {
      await filmsAPI.createFilm(filmData);
    }

    // Обновить список фильмов
    fetchFilms();
    handleCloseDialog();
  } catch (error) {
    console.error('Failed to save film:', error);
  }
};
```

---

## 🚀 Запуск фронтенда

После внесения изменений:

1. **Остановите сервер фронтенда** (если запущен): `Ctrl+C`

2. **Перезапустите сервер:**
   ```bash
   cd frontend
   npm start
   ```

3. **Откройте приложение:** http://localhost:3000

---

## 📊 Пример структуры данных

### Получение фильма (GET /api/v1/films/{id}):
```json
{
  "id": 1,
  "title": "Оппенгеймер",
  "original_title": "Oppenheimer",
  "description": "История американского физика...",
  "genres": [
    { "id": 1, "name": "Биография" },
    { "id": 2, "name": "Драма" },
    { "id": 3, "name": "История" }
  ],
  "age_rating": "16+",
  "duration_minutes": 180,
  ...
}
```

### Создание фильма (POST /api/v1/films):
```json
{
  "title": "Новый фильм",
  "original_title": "New Movie",
  "description": "Описание...",
  "genre_ids": [1, 2, 3],  // Массив ID жанров
  "age_rating": "12+",
  "duration_minutes": 120,
  ...
}
```

### Обновление фильма (PUT /api/v1/films/{id}):
```json
{
  "title": "Обновленное название",
  "genre_ids": [2, 4, 5],  // Новый набор жанров
  ...
}
```

---

## 🎨 Material-UI компоненты

Для работы с жанрами используйте:

- **Chip** - для отображения жанров как тегов
- **Select с multiple** - для мультиселекта при редактировании
- **Autocomplete** - альтернатива Select (более функциональный)

### Пример с Autocomplete (более красивый вариант):

```jsx
import { Autocomplete, TextField } from '@mui/material';

<Autocomplete
  multiple
  options={genres}
  getOptionLabel={(option) => option.name}
  value={genres.filter(g => selectedGenreIds.includes(g.id))}
  onChange={(event, newValue) => {
    setSelectedGenreIds(newValue.map(g => g.id));
  }}
  renderInput={(params) => (
    <TextField {...params} label="Жанры" placeholder="Выберите жанры" />
  )}
  renderTags={(value, getTagProps) =>
    value.map((option, index) => (
      <Chip
        label={option.name}
        size="small"
        {...getTagProps({ index })}
      />
    ))
  }
/>
```

---

## ⚠️ Важные моменты

1. **Обратная совместимость**: Старое поле `genre` больше не используется
2. **Валидация**: Убедитесь, что хотя бы один жанр выбран перед отправкой
3. **Загрузка жанров**: Делайте это один раз при монтировании компонента
4. **Обработка ошибок**: Добавьте try-catch при работе с API

---

## 🧪 Тестирование

1. **Создайте новый фильм** с несколькими жанрами
2. **Отредактируйте существующий фильм** - измените жанры
3. **Проверьте фильтрацию** на главной странице
4. **Проверьте отображение** жанров в карточке фильма

---

## 📞 Нужна помощь?

Если возникнут вопросы или ошибки:
1. Проверьте консоль браузера (F12)
2. Проверьте Network tab - какие запросы отправляются
3. Убедитесь, что backend запущен на http://localhost:8000
4. Проверьте Swagger UI: http://localhost:8000/docs
