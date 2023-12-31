import { zodResolver } from "@hookform/resolvers/zod";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRef, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
	View,
	TouchableOpacity,
	ScrollView,
	Pressable,
	Dimensions,
	TextInput,
	Keyboard,
	KeyboardAvoidingView,
	Platform,
} from "react-native";
import Animated, {
	useAnimatedRef,
	useAnimatedScrollHandler,
	useDerivedValue,
	useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import * as z from "zod";

import { Text, Input, Button, Alert } from "@/components/ui";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/hooks/useAuth";
import tw from "@/lib/tailwind";
import { ProtectedStackParamList } from "@/routes/protected";
import { useProfileStore, ProfileState } from "@/stores/profileStore";
import { Status } from "@/types/profile";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type SettingsProps = NativeStackScreenProps<
	ProtectedStackParamList,
	"Settings"
>;

const selectionOptions = [
	"Settings",
	"Username",
	"Password",
	"Profile Picture",
	"Update Status",
];

const statusOptions = ["active", "away", "busy", "offline"];

export default function Settings({ navigation }: SettingsProps) {
	const { updateUsername, updateUserPassword, logout } = useAuth();
	const [selectionIndex, setSelectionIndex] = useState(0);
	const { profile, setProfile }: ProfileState = useProfileStore();
	const { checkUsernameAvailability } = useAuth();
	const textInputRef = useRef<TextInput>(null);

	const [isUsernameAvailable, setIsUsernameAvailable] = useState<
		boolean | null
	>(null);
	const [isPasswordVisible, setIsPasswordVisible] = useState<boolean>(false);
	const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] =
		useState<boolean>(false);

	const defaultPic = require("@/assets/icons/avatar.svg");
	const [profileImage, setProfileImage] = useState(defaultPic);
	const [userStatus, setUserStatus] = useState<Status>(profile?.status!);

	const scrollRef = useAnimatedRef<ScrollView>();
	const alertRef = useRef<any>(null);
	const translateX = useSharedValue(0);
	const scrollHandler = useAnimatedScrollHandler({
		onScroll: (event) => {
			translateX.value = event.contentOffset.x;
		},
	});

	// Triggers the validation of the username field.
	// If the username is valid, it checks if it's available.
	// If the username is available, it sets the state to true.
	// If the username is not available, it sets the state to false.
	async function updateUsernameAvailability() {
		trigger("username").then((isValid) => {
			if (isValid) {
				if (getValues("username") === profile?.username) {
					setIsUsernameAvailable(true);
				} else {
					checkUsernameAvailability(getValues("username")).then(
						(isUsernameAvailable) => {
							setIsUsernameAvailable(isUsernameAvailable);
						},
					);
				}
			}
		});
	}

	async function onSubmit() {
		// If the user is on the username screen.
		if (selectionIndex === 1) {
			// Trigger the validation of the username field.
			trigger("username").then((isValid) => {
				// If the username is valid.
				if (isValid) {
					// Update the username. Display a success message. Go back to the previous screen.
					try {
						updateUsername(getValues("username"));

						alertRef.current?.showAlert({
							title: "Success!",
							message: "Your username has been updated.",
							variant: "success",
						});

						handleScrollBackward();
					} catch (error) {
						// @ts-ignore
						alertRef.current?.showAlert({
							title: "Oops!",
							// @ts-ignore
							message: error.message + ".",
							variant: "error",
						});
					}
				}
			});
			// If the user is on the password screen.
		} else if (selectionIndex === 2) {
			// Trigger the validation of the password field.
			trigger("password").then((isValid) => {
				// If the password is valid.
				if (isValid) {
					// Trigger the validation of the confirmPassword field.
					trigger("confirmPassword").then((isValid2) => {
						// If the confirmPassword is valid.
						if (isValid2) {
							// Update the password. Display a success message. Go back to the previous screen.
							try {
								updateUserPassword(getValues("password"));

								alertRef.current?.showAlert({
									title: "Success!",
									message: "Your password has been updated.",
									variant: "success",
								});

								handleScrollBackward();
							} catch (error) {
								// @ts-ignore
								alertRef.current?.showAlert({
									title: "Oops!",
									// @ts-ignore
									message: error.message + ".",
									variant: "error",
								});
							}
						}
					});
				}
			});
		}
	}

	const formSchema = z
		.object({
			password: z
				.string({
					required_error: "Oops! A password is required.",
				})
				.min(10, "Oops! Enter at least 10 characters.")
				.regex(/^(?=.*[a-z])/, "Oops! Missing a lowercase letter.")
				.regex(/^(?=.*[A-Z])/, "Oops! Missing an uppercase letter.")
				.regex(/^(?=.*[0-9])/, "Oops! Missing a number.")
				.regex(/^(?=.*[!@#$%^&*])/, "Oops! Missing a special character."),
			confirmPassword: z.string({
				required_error: "Oops! A password is required.",
			}),
			username: z
				.string({
					required_error: "Oops! A username is required.",
				})
				.min(3, "Oops! Your username is too short.")
				.regex(
					/^(?=.*[a-zA-Z0-9])([a-zA-Z0-9_]+\.)*[a-zA-Z0-9_]+$/,
					"Oops! That's not a valid username.",
				)
				.max(20, "Oops! Your username is too long."),
		})
		.refine((data) => data.password === data.confirmPassword, {
			message: "Oops! Passwords don't match.",
			path: ["confirmPassword"],
		});

	const {
		control,
		trigger,
		getValues,
		setValue,
		reset,
		formState: { errors, isSubmitting },
	} = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
	});

	const activeIndex = useDerivedValue(() => {
		return Math.round(translateX.value / SCREEN_WIDTH);
	});

	const handleScrollForward = () => {
		scrollRef.current?.scrollTo({
			x: SCREEN_WIDTH * (activeIndex.value + 1),
		});
	};

	const handleScrollBackward = () => {
		if (selectionIndex === 0) {
			navigation.goBack();
		}
		setSelectionIndex(0);
		Keyboard.dismiss();
		reset();
		scrollRef.current?.scrollTo({ x: 0 });
	};
	const pickImage = async () => {
		try {
			const result = await ImagePicker.launchImageLibraryAsync({
				mediaTypes: ImagePicker.MediaTypeOptions.Images,
				allowsEditing: true,
				aspect: [1, 1],
				quality: 1,
			});
			if (!result.canceled) {
				const profileImageUri = result.assets[0].uri;
				const imageSource = { uri: profileImageUri };
				setProfileImage(imageSource || defaultPic);
			}
		} catch (error) {
			console.error("Error picking image:", error);
			throw error; // Rethrow the error to handle it elsewhere if needed
		}
	};

	const updateAvatar = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				throw new Error("User not authenticated");
			}

			// Upload the new profile picture to the "avatars" bucket
			const { error: uploadError } = await supabase.storage
				.from("avatars")
				.upload(`user-${user?.id}.jpg`, profileImage, {
					contentType: "image/jpeg", // Optional: Set cache control headers
				});

			if (uploadError) {
				const { error: updateError } = await supabase.storage
					.from("avatars")
					.update(`user-${user?.id}.jpg`, profileImage, {
						contentType: "image/jpeg", // Optional: Set cache control headers
					});
				if (updateError) {
					console.error("Error updating profile picture:", uploadError.message);
				} else {
					const userId = user.id;

					const { data } = await supabase.storage
						.from("avatars")
						.createSignedUrl(`user-${user?.id}.jpg`, 31536000);
					console.log(profileImage);
					const { error: profileError } = await supabase
						.from("profiles")
						.update({ avatar_url: data?.signedUrl })
						.eq("id", userId);
					if (profileError) {
						throw profileError;
					}

					setProfile({
						id: profile!.id,
						email: profile!.email,
						username: profile!.username,
						first_name: profile!.first_name,
						last_name: profile!.last_name,
						avatar_url: data?.signedUrl,
						status: profile!.status,
					});

					console.log(
						"Profile picture updated successfully:",
						JSON.stringify(profileImage),
					);

					alertRef.current?.showAlert({
						title: "Success!",
						message: "Your profile picture has been updated.",
						variant: "success",
					});

					handleScrollBackward();
				}
			} else {
				const userId = user.id;

				const { data } = await supabase.storage
					.from("avatars")
					.createSignedUrl(`user-${user?.id}.jpg`, 31536000);
				const { error: profileError } = await supabase
					.from("profiles")
					.update({ avatar_url: data?.signedUrl })
					.eq("id", userId);

				if (profileError) {
					throw profileError;
				}

				setProfile({
					id: profile!.id,
					email: profile!.email,
					username: profile!.username,
					first_name: profile!.first_name,
					last_name: profile!.last_name,
					avatar_url: data?.signedUrl,
					status: profile!.status,
				});

				console.log(
					"Profile picture uploaded successfully:",
					JSON.stringify(profileImage),
				);

				alertRef.current?.showAlert({
					title: "Success!",
					message: "Your profile picture has been uploaded.",
					variant: "success",
				});

				handleScrollBackward();
			}
		} catch (error) {
			console.error("Error updating profile picture:", error);
			throw error;
		}
	};

	const updateUserStatus = async (newStatus: Status) => {
		try {
			const { error } = await supabase
				.from("profiles")
				.update({ status: newStatus })
				.eq("id", profile?.id);

			if (error) {
				throw error;
			}

			setProfile({
				id: profile!.id,
				email: profile!.email,
				username: profile!.username,
				first_name: profile!.first_name,
				last_name: profile!.last_name,
				avatar_url: profile!.avatar_url,
				status: newStatus,
			});

			console.log("User status updated successfully");

			alertRef.current?.showAlert({
				title: "Success!",
				message: "Your status has been updated.",
				variant: "success",
			});

			handleScrollBackward();
		} catch (error) {
			console.error("Error updating user status:", error);

			alertRef.current?.showAlert({
				title: "Oops!",
				// @ts-ignore
				message: error.message + ".",
				variant: "error",
			});

			throw error;
		}
	};

	return (
		<SafeAreaView style={tw`flex-1 bg-white`}>
			<Alert ref={alertRef} />
			<KeyboardAvoidingView
				style={tw`flex-1`}
				behavior={Platform.OS === "ios" ? "padding" : "height"}
			>
				{/* Title and back button */}
				<View
					style={tw`flex flex-row items-center justify-center w-full py-[0.6875rem]`}
				>
					<Pressable
						style={tw`absolute left-4`}
						hitSlop={24}
						onPress={handleScrollBackward}
					>
						<Image
							style={tw`w-6 h-6`}
							source={
								selectionIndex === 0
									? require("@/assets/icons/x.svg")
									: require("@/assets/icons/chevron-left-black.svg")
							}
						/>
					</Pressable>
					<Text variant="body" weight="semibold">
						{selectionOptions[selectionIndex]}
					</Text>
				</View>

				{/* Two horizontally oriented screens */}
				<Animated.ScrollView
					ref={scrollRef as any}
					onScroll={scrollHandler}
					showsHorizontalScrollIndicator={false}
					scrollEnabled={false}
					scrollEventThrottle={8}
					horizontal
					pagingEnabled
					style={tw`flex-1`}
				>
					{/* Screen One */}
					<View style={tw`flex-1 w-[${SCREEN_WIDTH}px] pt-6`}>
						<Text
							style={tw`text-content-secondary px-4`}
							variant="caption1"
							weight="semibold"
						>
							ACCOUNT
						</Text>
						<TouchableOpacity
							style={tw`flex flex-row justify-between w-full p-4 border-b border-b-border`}
							onPress={() => {
								// Set the index so we know to move horizontally and update the title.
								setSelectionIndex(1);
								// Set the username value of the form.
								setValue("username", profile?.username!);
								// Check the username availability right away.
								updateUsernameAvailability();
								// Finally, go to the screen.
								handleScrollForward();
							}}
						>
							<Text weight="semibold">Username</Text>
							<Image
								style={tw`w-6 h-6`}
								source={require("@/assets/icons/chevron-right-gray.svg")}
							/>
						</TouchableOpacity>
						<TouchableOpacity
							style={tw`flex flex-row justify-between w-full p-4 border-b border-b-border`}
							onPress={() => {
								handleScrollForward();
								setSelectionIndex(2);
							}}
						>
							<Text weight="semibold">Password</Text>
							<Image
								style={tw`w-6 h-6`}
								source={require("@/assets/icons/chevron-right-gray.svg")}
							/>
						</TouchableOpacity>
						<TouchableOpacity
							style={tw`flex flex-row justify-between w-full p-4 border-b border-b-border`}
							onPress={() => {
								handleScrollForward();
								setSelectionIndex(3);
							}}
						>
							<Text weight="semibold">Profile Picture</Text>
							<Image
								style={tw`w-6 h-6`}
								source={require("@/assets/icons/chevron-right-gray.svg")}
							/>
						</TouchableOpacity>
						<TouchableOpacity
							style={tw`flex flex-row justify-between w-full p-4 border-b border-b-border`}
							onPress={() => {
								handleScrollForward();
								setSelectionIndex(4);
							}}
						>
							<Text weight="semibold">Update Status</Text>
							<Image
								style={tw`w-6 h-6`}
								source={require("@/assets/icons/chevron-right-gray.svg")}
							/>
						</TouchableOpacity>
						<TouchableOpacity
							style={tw`flex flex-row justify-between w-full p-4`}
							onPress={() => {
								logout();
							}}
						>
							<Text weight="semibold">Logout</Text>
							<Image
								style={tw`w-6 h-6`}
								source={require("@/assets/icons/logout-red.svg")}
							/>
						</TouchableOpacity>
					</View>

					{/* Screen Two. Technically, four screens, but only the selected one is shown */}

					{/* Status */}
					<View
						style={tw`flex items-center justify-center w-[${SCREEN_WIDTH}px] px-12 pt-6 ${
							selectionIndex === 4 ? "" : "hidden"
						}`}
					>
						<View style={tw`flex-1 w-full gap-y-4`}>
							{statusOptions.map((status, index) => (
								<TouchableOpacity
									key={index}
									style={[
										tw`h-12 px-4 rounded-xl flex flex-row items-center justify-between`,
										userStatus === status && tw`bg-border`,
									]}
									onPress={() => {
										setUserStatus(status as Status);
									}}
								>
									<Text style={tw`capitalize`} weight="semibold">
										{status}
									</Text>
									<View
										style={[
											tw`w-[1.125rem] h-[1.125rem] rounded-full border-2 border-white`,
											status === "active" && tw`bg-green-500`,
											status === "away" && tw`bg-yellow-500`,
											status === "busy" && tw`bg-red-500`,
											status === "offline" && tw`bg-gray-500`,
										]}
									/>
								</TouchableOpacity>
							))}
						</View>
						<Button
							variant="secondary"
							label="Save"
							style={tw`bottom-4 absolute`}
							onPress={() => {
								updateUserStatus(userStatus);
							}}
							loading={isSubmitting}
						/>
					</View>

					{/* Profile Picture */}
					<View
						style={tw`flex items-center justify-center w-[${SCREEN_WIDTH}px] px-12 ${
							selectionIndex === 3 ? "" : "hidden"
						}`}
					>
						<View style={tw`w-[12.5rem] h-[12.5rem]`}>
							<Image
								// style={tw`w-[12.5rem] h-[12.5rem]`}
								style={tw`w-full h-full rounded-full overflow-hidden`}
								source={
									profileImage?.uri
										? profileImage
										: profile?.avatar_url
										? { uri: profile?.avatar_url }
										: require("@/assets/icons/avatar.svg")
								}
							/>
							<Pressable
								style={tw`absolute w-16 h-16 bottom-0 right-0 rounded-full bg-white shadow-md items-center justify-center`}
								onPress={() => pickImage()}
							>
								<Image
									style={tw`w-6 h-6`}
									source={require("@/assets/icons/edit.svg")}
								/>
							</Pressable>
						</View>
						<Button
							variant="secondary"
							label="Save"
							style={tw`bottom-4 absolute`}
							onPress={() => updateAvatar()}
							loading={isSubmitting}
						/>
					</View>

					{/* Passwords */}
					<View
						style={tw`w-[${SCREEN_WIDTH}px] px-12 pt-6 ${
							selectionIndex === 2 ? "" : "hidden"
						}`}
					>
						<View style={tw`mb-4`}>
							<Controller
								control={control}
								name="password"
								render={({ field: { onChange, value } }) => (
									<Input
										placeholder="Password"
										icon={
											<Pressable
												onPress={() => {
													setIsPasswordVisible(!isPasswordVisible);
												}}
											>
												<Image
													source={
														isPasswordVisible
															? require("@/assets/icons/eye-close.svg")
															: require("@/assets/icons/eye.svg")
													}
													style={tw`w-6 h-6 rounded-full`}
												/>
											</Pressable>
										}
										secureTextEntry={!isPasswordVisible}
										description="Strong passwords consist of at least 10 characters and should include a combination of uppercase and lowercase letters, special characters, and numbers."
										error={errors.password?.message}
										value={value}
										onChangeText={onChange}
										maxLength={64}
										indicator={
											<View style={tw`flex-row items-center gap-x-2 mt-6`}>
												<Image
													style={tw`w-6 h-6`}
													source={
														getValues("password") === undefined ||
														getValues("password") === ""
															? require("@/assets/icons/bar.svg")
															: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z\d]).{10,}$/.test(
																	getValues("password"),
															  )
															? require("@/assets/icons/bar-green.svg") // Strong password
															: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)|(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z\d]).{10,}$/.test(
																	getValues("password"),
															  )
															? require("@/assets/icons/bar-yellow.svg") // Moderate password
															: /^.{8,}$/.test(getValues("password"))
															? require("@/assets/icons/bar-red.svg") // Weak password
															: require("@/assets/icons/bar-red.svg")
													}
												/>

												<Text
													variant="subheadline"
													weight="semibold"
													style={tw`text-content-tertiary`}
												>
													Password Strength
												</Text>
											</View>
										}
									/>
								)}
							/>
						</View>
						<Controller
							control={control}
							name="confirmPassword"
							render={({ field: { onChange, value } }) => (
								<Input
									placeholder="Confirm Password"
									icon={
										<Pressable
											onPress={() => {
												setIsConfirmPasswordVisible(!isConfirmPasswordVisible);
											}}
										>
											<Image
												source={
													isConfirmPasswordVisible
														? require("@/assets/icons/eye-close.svg")
														: require("@/assets/icons/eye.svg")
												}
												style={tw`w-6 h-6`}
											/>
										</Pressable>
									}
									secureTextEntry={!isConfirmPasswordVisible}
									description="In order to continue, re-enter your password exactly the same as before."
									error={errors.confirmPassword?.message}
									value={value}
									onChangeText={onChange}
									maxLength={64}
									indicator={
										<View style={tw`flex-row items-center gap-x-2 mt-6`}>
											<Image
												source={
													// Check if either password or confirmPassword is undefined or empty
													getValues("password") === undefined ||
													getValues("password") === "" ||
													getValues("confirmPassword") === undefined ||
													getValues("confirmPassword") === ""
														? require("@/assets/icons/circle-check.svg") // Show circle-check.svg
														: getValues("password") ===
														  getValues("confirmPassword")
														? require("@/assets/icons/circle-check-green.svg") // Show circle-check-green.svg
														: require("@/assets/icons/circle-check.svg")
												}
												style={tw`w-6 h-6`}
											/>
											<Text
												variant="subheadline"
												weight="semibold"
												style={tw`text-content-tertiary`}
											>
												Passwords Match
											</Text>
										</View>
									}
								/>
							)}
						/>
						<Button
							variant="secondary"
							label="Save"
							style={tw`absolute self-center bottom-4`}
							onPress={onSubmit}
							loading={isSubmitting}
						/>
					</View>

					{/* Username */}
					<View style={tw`flex w-[${SCREEN_WIDTH}px] px-12 pt-6 relative`}>
						<Controller
							control={control}
							name="username"
							render={({ field: { onChange, value } }) => (
								<Input
									ref={textInputRef}
									description="Your username will be displayed on your profile."
									indicator={
										<View style={tw`flex-row items-center gap-x-2 mt-6`}>
											<Image
												source={
													isUsernameAvailable === null
														? require("@/assets/icons/circle-check.svg")
														: isUsernameAvailable
														? require("@/assets/icons/circle-check-green.svg")
														: require("@/assets/icons/circle-x-red.svg")
												}
												style={tw`w-6 h-6`}
											/>
											<Text
												variant="subheadline"
												weight="semibold"
												style={tw`text-content-tertiary`}
											>
												Username Available
											</Text>
										</View>
									}
									error={errors.username?.message}
									defaultValue={profile?.username}
									value={value}
									onChangeText={(e) => {
										setIsUsernameAvailable(null);
										onChange(e);
									}}
									onSubmitEditing={updateUsernameAvailability}
								/>
							)}
						/>
						<Button
							variant="secondary"
							label="Save"
							style={tw`absolute self-center bottom-4`}
							onPress={onSubmit}
							loading={isSubmitting}
						/>
					</View>
				</Animated.ScrollView>
			</KeyboardAvoidingView>
		</SafeAreaView>
	);
}
