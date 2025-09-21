const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Định nghĩa schema cho User
const userSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  name: String,
  ngaysinh: String,
  Linkfb: String,
  Mota: String,
  avatar: String
});

const User = mongoose.model('User', userSchema);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Giới thiệu bản thân'),
  async initPrompt(client, config) {
    const profilePromptChannel = client.channels.cache.get(config.profileChannelId);
    if (profilePromptChannel) {
      try {
        const messages = await profilePromptChannel.messages.fetch({ limit: 100 });
        for (const message of messages.values()) {
          if (message.author.id === client.user.id && message.components.length > 0) {
            await message.delete();
            console.log('Đã xóa tin nhắn cũ chứa nút giới thiệu');
          }
        }
      } catch (error) {
        console.error('Lỗi khi xóa tin nhắn cũ trong kênh giới thiệu:', error);
      }

      const embed = new EmbedBuilder()
        .setColor('#FFD700') // Màu vàng
        .setTitle('👤 Giới Thiệu Bản Thân')
        .setDescription(
          '📝 Ấn nút dưới đây để giới thiệu về bản thân của bạn!\n\n' +
          '**Yêu Cầu**: Ghi **Tên thật** và **Ngày tháng năm sinh thật** của bạn, **Mô tả chi tiết** về bản thân để có thể kết bạn với nhiều bạn bè! 😊'
        );

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setCustomId('profile_button')
            .setLabel('Giới thiệu')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('👤')
        );

      try {
        await profilePromptChannel.send({ embeds: [embed], components: [row] });
        console.log('Đã gửi tin nhắn gợi ý giới thiệu đến kênh ');
      } catch (error) {
        console.error('Lỗi khi gửi tin nhắn gợi ý giới thiệu:', error);
      }
    } else {
      console.error('Không tìm thấy kênh với ID ');
    }
  },
  async execute(interaction, client, confessionCounter, incrementCounter, config) {
    // Xử lý nút giới thiệu
    if (interaction.isButton() && interaction.customId === 'profile_button') {
      const modal = new ModalBuilder()
        .setCustomId('profile_modal')
        .setTitle('Giới Thiệu Bản Thân');

      const nameInput = new TextInputBuilder()
        .setCustomId('profile_name')
        .setLabel('Họ và tên')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const birthInput = new TextInputBuilder()
        .setCustomId('profile_birth')
        .setLabel('Ngày tháng năm sinh (dd/mm/yyyy)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const fbInput = new TextInputBuilder()
        .setCustomId('profile_fb')
        .setLabel('Link Facebook')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const descInput = new TextInputBuilder()
        .setCustomId('profile_desc')
        .setLabel('Mô tả bản thân (tối đa 2000 từ)')
        .setStyle(TextInputStyle.Paragraph)
        .setMaxLength(2000)
        .setRequired(true);

      const nameRow = new ActionRowBuilder().addComponents(nameInput);
      const birthRow = new ActionRowBuilder().addComponents(birthInput);
      const fbRow = new ActionRowBuilder().addComponents(fbInput);
      const descRow = new ActionRowBuilder().addComponents(descInput);
      modal.addComponents(nameRow, birthRow, fbRow, descRow);

      await interaction.showModal(modal);
    }

    // Xử lý modal giới thiệu
    if (interaction.isModalSubmit() && interaction.customId === 'profile_modal') {
      await interaction.deferReply({ ephemeral: true }); // Trì hoãn phản hồi để tránh timeout

      const name = interaction.fields.getTextInputValue('profile_name');
      const birth = interaction.fields.getTextInputValue('profile_birth');
      const fb = interaction.fields.getTextInputValue('profile_fb').trim();
      const desc = interaction.fields.getTextInputValue('profile_desc');
      const avatar = interaction.user.avatarURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png';

      const uid = interaction.user.id;

      try {
        // Kiểm tra link Facebook hợp lệ
        if (!fb.match(/^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/.+$/)) {
          await interaction.followUp({ content: '❌ Link Facebook không hợp lệ! Vui lòng cung cấp link Facebook chính xác (bắt đầu bằng http:// hoặc https://).', ephemeral: true });
          return;
        }

        // Lưu vào MongoDB
        await User.findOneAndUpdate(
          { uid },
          { name, ngaysinh: birth, Linkfb: fb, Mota: desc, avatar },
          { upsert: true, new: true }
        );

        const nickname = interaction.user.username; // Hoặc interaction.member.nickname nếu có
        const embed = new EmbedBuilder()
          .setColor('#FFD700') // Màu vàng
          .setTitle(`👤 THÔNG TIN CỦA ${nickname.toUpperCase()}`)
          .setDescription(
            `**👤 Họ và tên**: ${name}\n` +
            `**🎂 Ngày sinh**: ${birth}\n` +
            `**🔗 Link Facebook**: ${fb}\n` +
            `**📜 Mô tả**: ${desc}`
          )
          .setThumbnail(avatar);

        const profileChannel = client.channels.cache.get(config.profileChannelId);
        if (!profileChannel) {
          console.error('Không tìm thấy kênh giới thiệu');
          await interaction.followUp({ content: '❌ Không tìm thấy kênh giới thiệu!', ephemeral: true });
          return;
        }

        // Xóa tin nhắn gợi ý cũ (prompt)
        const messages = await profileChannel.messages.fetch({ limit: 100 });
        for (const message of messages.values()) {
          if (message.author.id === client.user.id && message.components.length > 0 && message.embeds[0]?.title === '👤 Giới Thiệu Bản Thân') {
            await message.delete();
            console.log('Đã xóa tin nhắn gợi ý giới thiệu cũ');
          }
        }

        // Chuẩn bị banner
        const bannerPath = path.join(__dirname, '..', 'assets', 'banner.gif');
        let files = [];
        if (fs.existsSync(bannerPath)) {
          files.push({ attachment: bannerPath, name: 'banner.gif' });
        } else {
          console.error('Không tìm thấy file banner tại:', bannerPath);
        }

        // Gửi embed thông tin kèm banner
        await profileChannel.send({ embeds: [embed], files });

        // Gửi lại tin nhắn gợi ý mới bên dưới
        const newEmbed = new EmbedBuilder()
          .setColor('#FFD700') // Màu vàng
          .setTitle('👤 Giới Thiệu Bản Thân')
          .setDescription(
            '📝 Ấn nút dưới đây để giới thiệu về bản thân của bạn!\n\n' +
            '**Yêu Cầu**: Ghi **Tên thật** và **Ngày tháng năm sinh thật** của bạn, **Mô tả chi tiết** về bản thân để có thể kết bạn với nhiều bạn bè! 😊'
          );

        const newRow = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setCustomId('profile_button')
              .setLabel('Giới thiệu')
              .setStyle(ButtonStyle.Primary)
              .setEmoji('👤')
          );

        await profileChannel.send({ embeds: [newEmbed], components: [newRow] });
        console.log('Đã gửi tin nhắn gợi ý giới thiệu mới');

        await interaction.followUp({ content: '✅ Giới thiệu của bạn đã được gửi!', ephemeral: true });
      } catch (error) {
        console.error('Lỗi khi gửi giới thiệu:', error);
        await interaction.followUp({ content: '❌ Có lỗi xảy ra khi gửi giới thiệu!', ephemeral: true });
      }
    }
  }
};