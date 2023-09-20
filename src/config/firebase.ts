import AsyncStorage from "@react-native-async-storage/async-storage";
import { initializeApp } from "firebase/app";
// @ts-ignore
import { initializeAuth, getReactNativePersistence } from "firebase/auth";

const firebaseConfig = {
	apiKey: "AIzaSyDZkGbZNNd6MG-eXBYhzcvBYL6YGsjn8lk",
	authDomain: "circles-da7a6.firebaseapp.com",
	projectId: "circles-da7a6",
	storageBucket: "circles-da7a6.appspot.com",
	//    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", //This is for push notifications later
	appId: "1:148136229772:android:4587fbaedf114db471b4a9",
};

const app = initializeApp(firebaseConfig);
const auth = initializeAuth(app, {
	persistence: getReactNativePersistence(AsyncStorage),
});

export { auth };