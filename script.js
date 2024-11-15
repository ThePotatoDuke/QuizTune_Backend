const clientId = "ddfd97f98dbd402788670fc5a2a118bf"; // Replace with your client ID
const params = new URLSearchParams(window.location.search);
const code = params.get("code");

if (!code) {
  redirectToAuthCodeFlow(clientId);
} else {
  const accessToken = await getAccessToken(clientId, code);
  const profile = await fetchProfile(accessToken);
  console.log(profile); // Profile data logs to console
  // Display a random favorite track
  await randomTrackQuestion(accessToken);
  populateUI(profile);
}

export async function redirectToAuthCodeFlow(clientId) {
  const verifier = generateCodeVerifier(128);
  const challenge = await generateCodeChallenge(verifier);

  localStorage.setItem("verifier", verifier);

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("response_type", "code");
  params.append("redirect_uri", "http://localhost:5173/");
  params.append("scope", "user-read-private user-read-email user-library-read"); // Updated scopes
  params.append("code_challenge_method", "S256");
  params.append("code_challenge", challenge);

  document.location = `https://accounts.spotify.com/authorize?${params.toString()}`;
}

function generateCodeVerifier(length) {
  let text = "";
  let possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(codeVerifier) {
  const data = new TextEncoder().encode(codeVerifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode.apply(null, [...new Uint8Array(digest)]))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function getAccessToken(clientId, code) {
  const verifier = localStorage.getItem("verifier");

  const params = new URLSearchParams();
  params.append("client_id", clientId);
  params.append("grant_type", "authorization_code");
  params.append("code", code);
  params.append("redirect_uri", "http://localhost:5173/");
  params.append("code_verifier", verifier);

  const result = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });

  const { access_token } = await result.json();
  return access_token;
}

async function fetchProfile(token) {
  const result = await fetch("https://api.spotify.com/v1/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
  });

  return await result.json();
}

async function fetchFavoriteTracks(token) {
  const limit = 50; // Maximum limit per Spotify API request
  let offset = 0;
  let allTracks = [];
  let totalFetched = 0;

  do {
    const result = await fetch(
      `https://api.spotify.com/v1/me/tracks?limit=${limit}&offset=${offset}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const data = await result.json();

    if (data.items && data.items.length > 0) {
      allTracks = allTracks.concat(data.items.map((item) => item.track));
      totalFetched = data.items.length;
      offset += totalFetched;
    } else {
      totalFetched = 0; // End the loop if no more items
    }
  } while (totalFetched > 0 && offset <= 50);

  return allTracks; // Array of all favorite tracks
}

function getRandomTrack(tracks) {
  const randomIndex = Math.floor(Math.random() * tracks.length);
  return tracks[randomIndex];
}

async function randomTrackQuestion(token) {
  const tracks = await fetchFavoriteTracks(token);
  console.log(tracks);
  if (tracks.length === 0) {
    console.log("No favorite tracks found.");
    return;
  }

  const randomTrack = getRandomTrack(tracks);
  console.log("Random Track:", randomTrack);

  // Generate and display a question about the track
  const { question, correctAnswer, questionType } =
    generateTrackQuestion(randomTrack);

  displayTrackQuestion({
    question,
    correctAnswer,
    questionType,
    tracks,
    token,
  });
}

function generateTrackQuestion(track) {
  const questionTypes = ["release_date", "artist", "popularity", "album_cover"];
  console.log(track); // Check if the track object has the expected properties

  // const questionType =
  //   questionTypes[Math.floor(Math.random() * questionTypes.length)];
  const questionType = questionTypes[3];

  let question, correctAnswer;

  switch (questionType) {
    case "release_date":
      question = `When was "${track.name}" by ${track.artists[0].name} released?`;
      correctAnswer = new Date(track.album.release_date).getFullYear(); // Make sure this data is available
      break;

    case "artist":
      question = `Who is the artist that made "${track.name}" ?`;
      correctAnswer = track.artists[0].name; // Get the main artist's name
      break;

    case "popularity":
      const popularity = track.popularity; // Get popularity from the track
      console.log("hellooo");
      question = `Is the popularity of "${track.name}" higher or lower than 50?`;
      correctAnswer = popularity > 50 ? "higher" : "lower"; // Set correct answer based on the popularity
      break;

    case "album_cover":
      question = `Identify the album cover for "${track.name}" by ${track.artists[0].name}.`;
      correctAnswer = track.album.images[0].url;
      break;
  }

  return { question, correctAnswer, questionType };
}
function generateAnswerOptions(correctAnswer, questionType, tracks) {
  let options = [];

  switch (questionType) {
    case "release_date":
      const correctYear = correctAnswer;
      options = [
        correctYear,
        correctYear - 1,
        correctYear + 1,
        correctYear + 2,
      ];
      break;

    case "artist": // Now using artists
      const randomArtists = [];
      for (let i = 0; i < 3; i++) {
        const randomTrack = getRandomTrack(tracks);
        const artistName = randomTrack.artists[0].name; // Get the main artist's name
        if (
          !randomArtists.includes(artistName) &&
          artistName !== correctAnswer
        ) {
          randomArtists.push(artistName);
        }
      }
      options = [correctAnswer, ...randomArtists.slice(0, 3)];
      break;

    case "popularity":
      options = ["Higher", "Lower"];
      break;

    case "album_cover":
      if (tracks.length === 0) {
        console.log("No favorite tracks found.");
        return;
      }

      const randomTracks = [];
      for (let i = 0; i < 3; i++) {
        randomTracks.push(getRandomTrack(tracks));
      }

      options = randomTracks.map((track) => track.album.images[0].url);

      options.push(correctAnswer);

      break;
  }

  // Shuffle options and return
  return options.sort(() => Math.random() - 0.5);
}
function displayTrackQuestion({
  question,
  correctAnswer,
  questionType,
  tracks,
}) {
  document.getElementById("question").innerText = question;
  const optionsContainer = document.getElementById("options");
  optionsContainer.innerHTML = ""; // Clear previous options

  // Generate answer options based on the question type
  const options = generateAnswerOptions(correctAnswer, questionType, tracks);

  // Create radio buttons for each option
  options.forEach((option, index) => {
    const optionContainer = document.createElement("div");

    const radioInput = document.createElement("input");
    radioInput.type = "radio";
    radioInput.name = "answer";
    radioInput.value = option;
    radioInput.id = `option${index}`;

    const label = document.createElement("label");
    label.htmlFor = `option${index}`;

    // Check if it's an album cover question
    if (questionType === "album_cover") {
      // If it's an album cover question, use option as an image URL
      const image = new Image(100, 100); // Adjust size as needed
      image.src = option; // Assuming option is the image URL
      label.appendChild(image); // Append image to label
    } else {
      // Otherwise, display the option as text (e.g., for artist or release date)
      label.innerText = option;
    }

    optionContainer.appendChild(radioInput);
    optionContainer.appendChild(label);
    optionsContainer.appendChild(optionContainer);
  });

  // Add a submit button for the user to confirm their answer
  const submitButton = document.createElement("button");
  submitButton.innerText = "Submit";
  submitButton.onclick = () => {
    const selectedOption = document.querySelector(
      "input[name='answer']:checked"
    );
    if (selectedOption) {
      checkAnswer(selectedOption.value, correctAnswer);
    } else {
      alert("Please select an answer.");
    }
  };
  optionsContainer.appendChild(submitButton);
}

function checkAnswer(userAnswer, correctAnswer) {
  let isCorrect;

  if (typeof correctAnswer === "number") {
    // Convert both values to numbers if `correctAnswer` is a number
    isCorrect = Number(userAnswer) === correctAnswer;
  } else {
    // For strings, compare them as lowercase to ignore case differences
    isCorrect = userAnswer.toLowerCase() === correctAnswer.toLowerCase();
  }

  alert(isCorrect ? "Correct!" : `Incorrect! The answer was ${correctAnswer}`);
}

function populateUI(profile) {
  document.getElementById("displayName").innerText = profile.display_name;
  if (profile.images[0]) {
    const profileImage = new Image(200, 200);
    profileImage.src = profile.images[0].url;
    document.getElementById("avatar").appendChild(profileImage);
    document.getElementById("imgUrl").innerText = profile.images[0].url;
  }
  document.getElementById("id").innerText = profile.id;
  document.getElementById("email").innerText = profile.email;
  document.getElementById("uri").innerText = profile.uri;
  document
    .getElementById("uri")
    .setAttribute("href", profile.external_urls.spotify);
  document.getElementById("url").innerText = profile.href;
  document.getElementById("url").setAttribute("href", profile.href);
}
