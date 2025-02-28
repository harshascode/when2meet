<script>
	const currentYear = new Date().getFullYear();
</script>

<footer class="site-footer bg-[#26272b] text-sm leading-6 text-[#737373]">
	<div class="container mx-auto px-4 py-6 md:py-8">
		<div class="grid grid-cols-1 gap-8 md:grid-cols-2">
			<!-- About Section -->
			<div>
				<h6 class="mb-4 text-base font-semibold tracking-wider text-white uppercase">About </h6>
				<p class="text-justify">
					<span class="font-medium">Whendomeet</span> is a younger sibling of When2meet.com. It's a newly upgraded, modern, elegant, aesthetic, and advanced version of When2meet. Whendomeet is a direct competitor to When2meet, but on steroids! You can find the perfect meeting time and date with this modern and elegant tool.
				</p>
			</div>

			<!-- Quick Links -->
			<div class="md:pl-8">
				<h6 class="mb-4 text-base font-semibold tracking-wider text-white uppercase">
					Quick Links
				</h6>
				<ul class="grid grid-cols-2 gap-2">
					<li>
						<a href="/" class="transition-colors duration-200 hover:text-[#3366cc]">
							Create Event
						</a>
					</li>
					<li>
						<a href="/my-events" class="transition-colors duration-200 hover:text-[#3366cc]">
							My Events
						</a>
					</li>
					<li>
						<a href="/privacy" class="transition-colors duration-200 hover:text-[#3366cc]">
							Privacy Policy
						</a>
					</li>
					<li>
						<a href="/terms" class="transition-colors duration-200 hover:text-[#3366cc]">
							Terms of Use
						</a>
					</li>
				</ul>
			</div>
		</div>

		<hr class="my-6 border-t border-[#bbb] opacity-50" />

		<!-- Copyright and Social Icons -->
		<div class="flex flex-col items-center gap-4 md:flex-row md:justify-between">
			<p class="text-center md:text-left">
				Copyright &copy; {currentYear} <a href="/" class="hover:text-[#3366cc]">Whendomeet</a>. All
				Rights Reserved.
			</p>

			<!-- Social Icons -->
			<ul class="flex gap-3">
				<li>
					<a
						href="https://github.com/harshascode/when2meet"
						target="_blank"
						rel="noopener noreferrer"
						class="flex h-10 w-10 items-center justify-center rounded-full bg-[#33353d] text-white transition-colors duration-200 hover:bg-[#29aafe]"
						aria-label="GitHub"
					>
						<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
							<path
								fill-rule="evenodd"
								d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
								clip-rule="evenodd"
							/>
						</svg>
					</a>
				</li>
				<!-- Add more social icons as needed -->
			</ul>
		</div>
	</div>
</footer>

<style>
	/* Any additional custom styles can go here */
	.site-footer {
		font-size: 15px;
		line-height: 24px;
	}
</style>
